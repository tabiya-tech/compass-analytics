from app.users.types import Action, Subject

ROLES: dict[str, list[tuple[Subject, Action]]] = {
    # Sees their own institution's dashboard and jobseeker data.
    "implementer": [
        (Subject.DASHBOARD, Action.VIEW),
        (Subject.JOBSEEKERS, Action.VIEW),
        (Subject.ACCOUNT, Action.VIEW),
    ],
    # Sees the cross-institution dashboard and can manage access across the deployment.
    "funder": [
        (Subject.DASHBOARD, Action.VIEW),
        (Subject.INSTITUTIONS, Action.VIEW),
        (Subject.ACCESS_MANAGEMENT, Action.MANAGE),
        (Subject.ACCOUNT, Action.VIEW),
    ],
    # Full visibility and access management scoped to a single institution.
    "institution_admin": [
        (Subject.DASHBOARD, Action.VIEW),
        (Subject.JOBSEEKERS, Action.VIEW),
        (Subject.INSTITUTIONS, Action.VIEW),
        (Subject.ACCESS_MANAGEMENT, Action.MANAGE),
        (Subject.ACCOUNT, Action.VIEW),
    ],
    # Every subject × every action, scoped to all institutions.
    "super_admin": [(subject, action) for subject in Subject for action in Action],
}
