"""Single source of truth for the application version.

The release workflow (.github/workflows/release.yml) rewrites the
``__version__`` line here at release time, so keep it as a bare string literal
of the form ``__version__ = "X.Y.Z"``.
"""

__version__ = "13.15.0"
