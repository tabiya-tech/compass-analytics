import casbin


def build_model() -> casbin.Model:
    """Domain model: sub=user_id, dom=institution_id|"*", perm="subject:action". dom="*" satisfies any institution."""
    m = casbin.Model()
    m.add_def("r", "r", "sub, dom, perm")
    m.add_def("p", "p", "sub, dom, perm")
    m.add_def("e", "e", "some(where (p.eft == allow))")
    m.add_def("m", "m", "r.sub == p.sub && (p.dom == r.dom || p.dom == '*') && r.perm == p.perm")
    return m
