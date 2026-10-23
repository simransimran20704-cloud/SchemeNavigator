from rest_framework import serializers
from django.contrib.auth.models import User


class SendOTPSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    purpose = serializers.ChoiceField(
        choices=['signup', 'login', 'reset'],
        default='signup'
    )


class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    otp = serializers.CharField(max_length=6, min_length=6, required=True)
    purpose = serializers.ChoiceField(
        choices=['signup', 'login', 'reset'],
        default='signup'
    )
    name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    password = serializers.CharField(max_length=128, required=False, allow_blank=True)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True)


class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    isLoggedIn = serializers.SerializerMethodField()
    token = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'isLoggedIn', 'token']

    def get_name(self, obj: User) -> str:
        name = obj.get_full_name()
        if name:
            return name
        if obj.first_name:
            return obj.first_name
        if obj.email:
            return obj.email.split('@')[0]
        return obj.username or "User"

    def get_isLoggedIn(self, obj: User) -> bool:
        return True

    def get_token(self, obj: User) -> str:
        return obj.email
