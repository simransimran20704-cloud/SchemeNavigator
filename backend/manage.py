#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc

    # If runserver is invoked without an explicit IP:PORT address, default to 0.0.0.0:8000
    # so devices on the local network (phones, tablets, other PCs) can connect directly.
    if len(sys.argv) > 1 and sys.argv[1] == "runserver":
        args_without_options = [arg for arg in sys.argv[2:] if not arg.startswith("-")]
        if not args_without_options:
            sys.argv.append("0.0.0.0:8000")

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
