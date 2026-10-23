from datetime import timedelta
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import EmailOTP


class AuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.email = "testuser@example.com"
        self.user = User.objects.create_user(
            username="existing@example.com",
            email="existing@example.com",
            first_name="Existing",
            password="secretpassword123",
        )

    def test_send_otp_signup(self):
        response = self.client.post(
            "/api/auth/send-otp/",
            {"email": "newuser@example.com", "purpose": "signup"},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(EmailOTP.objects.filter(email="newuser@example.com", purpose="signup").exists())

    def test_send_otp_signup_existing_user_succeeds_with_notice(self):
        response = self.client.post(
            "/api/auth/send-otp/",
            {"email": "existing@example.com", "purpose": "signup"},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.get("userExists"))
        self.assertIn("already exists", response.data.get("message", ""))

    def test_send_otp_login_nonexistent_user_succeeds_with_notice(self):
        response = self.client.post(
            "/api/auth/send-otp/",
            {"email": "doesnotexist@example.com", "purpose": "login"},
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data.get("userExists"))
        self.assertIn("No account found", response.data.get("message", ""))

    def test_verify_otp_signup_success(self):
        otp_record = EmailOTP.create_otp("freshuser@example.com", purpose="signup")
        response = self.client.post(
            "/api/auth/verify-otp/",
            {
                "email": "freshuser@example.com",
                "otp": otp_record.otp,
                "purpose": "signup",
                "name": "Fresh User",
                "password": "mypassword123",
            },
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("user", response.data)
        self.assertEqual(response.data["user"]["name"], "Fresh User")
        self.assertTrue(User.objects.filter(email="freshuser@example.com").exists())

    def test_verify_otp_invalid_code(self):
        otp_record = EmailOTP.create_otp("wrongcode@example.com", purpose="signup")
        response = self.client.post(
            "/api/auth/verify-otp/",
            {
                "email": "wrongcode@example.com",
                "otp": "000000",
                "purpose": "signup",
            },
            format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Incorrect", response.data.get("error", ""))

    def test_password_login(self):
        response = self.client.post(
            "/api/auth/login/",
            {
                "email": "existing@example.com",
                "password": "secretpassword123",
            },
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["email"], "existing@example.com")

    def test_cross_device_data_sync(self):
        # Device 1 logs in and saves profile, saved scheme, and tracker item
        device1 = APIClient(enforce_csrf_checks=True)
        login_res1 = device1.post(
            "/api/auth/login/",
            {"email": "existing@example.com", "password": "secretpassword123"},
            format="json"
        )
        self.assertEqual(login_res1.status_code, 200)

        # Device 1 updates profile
        prof_res1 = device1.put(
            "/api/profile/",
            {"age": 28, "gender": "Female", "state": "Odisha", "district": "Khordha"},
            format="json"
        )
        self.assertEqual(prof_res1.status_code, 200)

        # Device 1 saves a scheme
        save_res1 = device1.post(
            "/api/saved-schemes/pm-kisan/",
            {"scheme": {"id": "pm-kisan", "name": "PM-KISAN"}},
            format="json"
        )
        self.assertEqual(save_res1.status_code, 200)

        # Device 1 updates an application tracker item
        track_res1 = device1.put(
            "/api/tracker/tr-999/",
            {"application": {"id": "tr-999", "schemeId": "pm-kisan", "status": "Ready to Apply"}},
            format="json"
        )
        self.assertEqual(track_res1.status_code, 200)

        # Device 2 (new browser/device, different client) logs in with the SAME account
        device2 = APIClient(enforce_csrf_checks=True)
        login_res2 = device2.post(
            "/api/auth/login/",
            {"email": "existing@example.com", "password": "secretpassword123"},
            format="json"
        )
        self.assertEqual(login_res2.status_code, 200)

        # Device 2 verifies profile transferred from Device 1
        prof_res2 = device2.get("/api/profile/")
        self.assertEqual(prof_res2.status_code, 200)
        self.assertIsNotNone(prof_res2.data.get("profile"))
        self.assertEqual(prof_res2.data["profile"]["state"], "Odisha")
        self.assertEqual(prof_res2.data["profile"]["district"], "Khordha")

        # Device 2 verifies saved schemes transferred from Device 1
        saved_res2 = device2.get("/api/saved-schemes/")
        self.assertEqual(saved_res2.status_code, 200)
        saved_schemes = saved_res2.data.get("savedSchemes", [])
        self.assertTrue(any(s.get("id") == "pm-kisan" for s in saved_schemes))

        # Device 2 verifies application tracker transferred from Device 1
        track_res2 = device2.get("/api/tracker/")
        self.assertEqual(track_res2.status_code, 200)
        apps = track_res2.data.get("applications", [])
        self.assertTrue(any(a.get("schemeId") == "pm-kisan" and a.get("status") == "Ready to Apply" for a in apps))

        # Device 1 performs a batch upload of local saved schemes
        batch_res = device1.post(
            "/api/saved-schemes/",
            {"savedSchemes": [
                {"id": "ayushman-bharat-pmjay", "name": "Ayushman Bharat"},
                {"id": "sukanya-samriddhi", "name": "Sukanya Samriddhi"}
            ]},
            format="json"
        )
        self.assertEqual(batch_res.status_code, 200)

        # Device 2 retrieves saved schemes and confirms batch schemes appear
        saved_res2_after = device2.get("/api/saved-schemes/")
        self.assertEqual(saved_res2_after.status_code, 200)
        schemes2 = [s.get("id") for s in saved_res2_after.data.get("savedSchemes", [])]
        self.assertIn("ayushman-bharat-pmjay", schemes2)
        self.assertIn("sukanya-samriddhi", schemes2)
        self.assertIn("pm-kisan", schemes2)

        # Device 2 removes a scheme
        del_res = device2.delete("/api/saved-schemes/ayushman-bharat-pmjay/")
        self.assertEqual(del_res.status_code, 200)

        # Device 1 retrieves saved schemes and confirms the deletion is reflected
        saved_res1_after = device1.get("/api/saved-schemes/")
        schemes1 = [s.get("id") for s in saved_res1_after.data.get("savedSchemes", [])]
        self.assertNotIn("ayushman-bharat-pmjay", schemes1)
        self.assertIn("sukanya-samriddhi", schemes1)

