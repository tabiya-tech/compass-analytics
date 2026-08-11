from app.users.types import Action, Subject

ROLES: dict[str, list[tuple[Subject, Action]]] = {
    "implementer": [
        (Subject.DASHBOARD, Action.VIEW),
        (Subject.JOBSEEKERS, Action.VIEW),
        (Subject.ACCOUNT, Action.VIEW),
    ],
    "funder": [
        (Subject.DASHBOARD, Action.VIEW),
        (Subject.INSTITUTIONS, Action.VIEW),
        (Subject.ACCESS_MANAGEMENT, Action.MANAGE),
        (Subject.ACCOUNT, Action.VIEW),
    ],
}
