"""
Gmail addresses allowed into /admin. Anyone else who signs in through the
admin login is bounced back out, even though they use the same Google
sign-in flow as players.
"""
ADMIN_EMAILS = {
    "acm@dubai.bits-pilani.ac.in",  # TODO: add/replace with the real admin Gmail address(es)
}
