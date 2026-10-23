"""
Management command: import_schemes

Usage:
    python manage.py import_schemes
    python manage.py import_schemes --dry-run
"""
from django.conf import settings
from django.core.cache import cache
from django.core.management.base import BaseCommand, CommandError

from schemes.datasources import get_datasource
from schemes.models import Scheme


class Command(BaseCommand):
    help = "Import or sync schemes from live Government API (APIMitra / MyScheme)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            default="",
            help="Path to JSON file containing schemes (defaults to Frontend-Scheme-Navigator-main/public/data/schemes.json)",
        )
        parser.add_argument(
            "--url",
            type=str,
            default="",
            help="Government API URL (defaults to GOVT_SCHEME_API_URL from settings/.env)",
        )
        parser.add_argument(
            "--api-key",
            type=str,
            default="",
            help="Government API Key / Bearer token (defaults to GOVT_SCHEME_API_KEY from settings/.env)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Parse and validate without writing to the database",
        )

    def handle(self, *args, **options):
        import json
        from pathlib import Path
        dry_run = options["dry_run"]
        file_path = options["file"]
        url = options["url"] or getattr(settings, "GOVT_SCHEME_API_URL", "")
        api_key = options["api_key"] or getattr(settings, "GOVT_SCHEME_API_KEY", "")

        raw_schemes = []
        if file_path:
            p = Path(file_path)
            if not p.exists():
                raise CommandError(f"Schemes JSON file not found: {file_path}")
            self.stdout.write(f"Loading schemes from file: {file_path}")
            with open(p, encoding="utf-8") as f:
                raw_schemes = json.load(f)
        elif url:
            source_kwargs = {"url": url, "api_key": api_key}
            self.stdout.write("Using source: Government API (APIMitra / MyScheme)")
            try:
                datasource = get_datasource("api", **source_kwargs)
                raw_schemes = datasource.fetch_schemes()
            except (FileNotFoundError, NotImplementedError, ValueError) as exc:
                raise CommandError(str(exc)) from exc
        else:
            # Look for default schemes.json in frontend
            default_paths = [
                settings.BASE_DIR.parent / "Frontend-Scheme-Navigator-main" / "public" / "data" / "schemes.json",
                settings.BASE_DIR / "schemes.json",
            ]
            found_path = next((p for p in default_paths if p.exists()), None)
            if found_path:
                self.stdout.write(f"Using default schemes dataset: {found_path}")
                with open(found_path, encoding="utf-8") as f:
                    raw_schemes = json.load(f)
            else:
                raise CommandError(
                    "No data source provided. Provide --file, --url, or ensure schemes.json exists."
                )

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no database writes."))

        self.stdout.write(f"Fetched {len(raw_schemes)} scheme(s) from source.")

        inserted = updated = skipped = 0

        for data in raw_schemes:
            slug = data.get("slug", "").strip()
            if not slug:
                skipped += 1
                continue

            # Validate required fields
            if not data.get("name") or not data.get("category"):
                self.stderr.write(
                    self.style.WARNING(f"Skipping '{slug}': missing name or category.")
                )
                skipped += 1
                continue

            if dry_run:
                self.stdout.write(f"  [dry-run] Would upsert: {slug}")
                continue

            defaults = {
                "name": data.get("name", ""),
                "short_name": data.get("shortName") or data.get("short_name", ""),
                "tagline": data.get("tagline", ""),
                "category": data.get("category", "Financial Assistance"),
                "level": data.get("level", "Central"),
                "covered_states": data.get("coveredStates") or data.get("covered_states", []),
                "short_description": data.get("shortDescription") or data.get("short_description", ""),
                "detailed_description": data.get("detailedDescription") or data.get("detailed_description", ""),
                "eligibility": data.get("eligibility", {}),
                "benefits": data.get("benefits", []),
                "documents": data.get("documents", []),
                "application_steps": data.get("applicationSteps") or data.get("application_steps", []),
                "verification": data.get("verification", {}),
                "popular_score": float(data.get("popularScore") or data.get("popular_score") or 0.0),
                "tags": data.get("tags", []),
            }

            _, created = Scheme.objects.update_or_create(
                slug=slug,
                defaults=defaults,
            )
            if created:
                inserted += 1
            else:
                updated += 1

        if not dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Done. Inserted: {inserted} | Updated: {updated} | Skipped: {skipped}"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Dry run complete. Would process: {len(raw_schemes)} record(s)."
                )
            )
