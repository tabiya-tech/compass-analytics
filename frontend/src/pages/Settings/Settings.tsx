import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { updateProfile, type User as FirebaseUser } from "firebase/auth";
import { toast } from "sonner";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScreenHead } from "@/components/shared/ScreenHead";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useAuth } from "@/auth/AuthContext";
import { useAccess, type AccessScope } from "@/access/AccessContext";
import { ROLE_LABEL_KEYS } from "@/access/roles";
import { UserService } from "@/user/User.service";
import { cn } from "@/lib/utils";

type Translate = ReturnType<typeof useTranslation>["t"];

const uniqueId = "f965306e-f88e-4dcb-bdaa-4c681e0f10d8";

export const DATA_TEST_ID = {
  CONTAINER: `settings-container-${uniqueId}`,
  PROFILE_CARD: `settings-profile-card-${uniqueId}`,
  PROFILE_NAME: `settings-profile-name-${uniqueId}`,
  PROFILE_ROLE_SUBTITLE: `settings-profile-role-subtitle-${uniqueId}`,
  PROFILE_DETAIL: `settings-profile-detail-${uniqueId}`,
  NAME_INPUT: `settings-name-input-${uniqueId}`,
  ORGANIZATION_INPUT: `settings-organization-input-${uniqueId}`,
  EDIT_PROFILE_BUTTON: `settings-edit-profile-button-${uniqueId}`,
  SAVE_PROFILE_BUTTON: `settings-save-profile-button-${uniqueId}`,
  CANCEL_PROFILE_BUTTON: `settings-cancel-profile-button-${uniqueId}`,
};

// The visual cue that a field is part of the active edit.
const EDITABLE_FIELD_HIGHLIGHT = "border-tabiya-green focus-visible:ring-tabiya-green/40";

function describeScope(t: Translate, scope: AccessScope): string {
  if (scope.type === "all") return t("settings.profile.scopeAll");
  return scope.institutionIds.length === 1
    ? t("settings.profile.scopeOneInstitution")
    : t("settings.profile.scopeInstitutions", { count: scope.institutionIds.length });
}

function ProfileDetail({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div
      data-testid={DATA_TEST_ID.PROFILE_DETAIL}
      className="flex min-w-0 items-baseline justify-between gap-6 border-b border-border py-3.5 last:border-b-0"
    >
      <dt className="shrink-0 text-grey-text">{label}</dt>
      <dd className="min-w-0 text-right wrap-anywhere text-foreground">{value}</dd>
    </div>
  );
}

interface NameFieldProps {
  currentName: string;
  isEditingProfile: boolean;
  draftName: string;
  onDraftNameChange: (value: string) => void;
  isSavingProfile: boolean;
}

function NameField({
  currentName,
  isEditingProfile,
  draftName,
  onDraftNameChange,
  isSavingProfile,
}: Readonly<NameFieldProps>) {
  const { t } = useTranslation();

  if (!isEditingProfile) {
    return (
      <p data-testid={DATA_TEST_ID.PROFILE_NAME} className="min-w-0 text-xl font-bold wrap-anywhere text-foreground">
        {currentName}
      </p>
    );
  }

  return (
    <Input
      data-testid={DATA_TEST_ID.NAME_INPUT}
      aria-label={t("settings.profile.name.editLabel")}
      value={draftName}
      onChange={(event) => onDraftNameChange(event.target.value)}
      placeholder={t("settings.profile.name.placeholder")}
      autoFocus
      disabled={isSavingProfile}
      className={cn("min-w-0 text-xl font-bold", EDITABLE_FIELD_HIGHLIGHT)}
    />
  );
}

interface OrganizationRowProps {
  currentOrganization: string;
  isEditingProfile: boolean;
  draftOrganization: string;
  onDraftOrganizationChange: (value: string) => void;
  isSavingProfile: boolean;
}

function OrganizationRow({
  currentOrganization,
  isEditingProfile,
  draftOrganization,
  onDraftOrganizationChange,
  isSavingProfile,
}: Readonly<OrganizationRowProps>) {
  const { t } = useTranslation();

  return (
    <div
      data-testid={DATA_TEST_ID.PROFILE_DETAIL}
      className="flex min-w-0 items-center justify-between gap-6 border-b border-border py-[13px] last:border-b-0"
    >
      <dt className="shrink-0 text-muted-foreground">{t("settings.profile.organization.label")}</dt>
      <dd className="min-w-0 flex-1">
        {isEditingProfile ? (
          <Input
            data-testid={DATA_TEST_ID.ORGANIZATION_INPUT}
            aria-label={t("settings.profile.organization.editLabel")}
            value={draftOrganization}
            onChange={(event) => onDraftOrganizationChange(event.target.value)}
            placeholder={t("settings.profile.organization.placeholder")}
            disabled={isSavingProfile}
            className={cn("ml-auto h-8 max-w-56", EDITABLE_FIELD_HIGHLIGHT)}
          />
        ) : (
          <span className="block text-right wrap-anywhere text-foreground">{currentOrganization}</span>
        )}
      </dd>
    </div>
  );
}

/** Firebase has no update-listener hook, so a caller re-renders with the new name only if it asks again. */
async function trySyncFirebaseDisplayName(user: FirebaseUser, newName: string): Promise<void> {
  try {
    await updateProfile(user, { displayName: newName });
  } catch {
    // The backend save is what makes this screen correct; this is a nice-to-have on top of it.
  }
}

export function Settings() {
  const { t } = useTranslation();
  const { user, getIdToken } = useAuth();
  const { scope, role, name: nameOnBackendRecord, organization: organizationOnBackendRecord } = useAccess();

  // Neither user.displayName nor nameOnBackendRecord updates itself after a save in this session,
  // so without tracking each save locally the card would revert until the next full page load.
  const [nameSavedThisSession, setNameSavedThisSession] = useState<string | null>(null);
  const [organizationSavedThisSession, setOrganizationSavedThisSession] = useState<string | null>(null);

  const currentName = nameSavedThisSession ?? user?.displayName ?? nameOnBackendRecord ?? t("common.myAccount");
  const currentNameIsUnsetPlaceholder = !nameSavedThisSession && !user?.displayName && !nameOnBackendRecord;
  const unknownValuePlaceholder = t("common.unknown");
  const currentOrganization = organizationSavedThisSession ?? organizationOnBackendRecord ?? unknownValuePlaceholder;
  const currentOrganizationIsUnsetPlaceholder = !organizationSavedThisSession && !organizationOnBackendRecord;

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftOrganization, setDraftOrganization] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const startEditingProfile = () => {
    setDraftName(currentNameIsUnsetPlaceholder ? "" : currentName);
    setDraftOrganization(currentOrganizationIsUnsetPlaceholder ? "" : currentOrganization);
    setIsEditingProfile(true);
  };

  const cancelEditingProfile = () => setIsEditingProfile(false);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = draftName.trim();
    if (!trimmedName || isSavingProfile) return;

    setIsSavingProfile(true);
    try {
      const trimmedOrganization = draftOrganization.trim();
      const token = await getIdToken();
      await UserService.getInstance().register(token, {
        name: trimmedName,
        organization: trimmedOrganization || undefined,
      });
      setNameSavedThisSession(trimmedName);
      if (trimmedOrganization) setOrganizationSavedThisSession(trimmedOrganization);
      if (user) await trySyncFirebaseDisplayName(user, trimmedName);
      setIsEditingProfile(false);
    } catch {
      toast.error(t("settings.profile.saveError"));
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div data-testid={DATA_TEST_ID.CONTAINER} className="grid content-start gap-8 px-8 pt-8 pb-20">
      <ScreenHead eyebrow={t("settings.eyebrow")} title={t("settings.title")} />

      <Card data-testid={DATA_TEST_ID.PROFILE_CARD} className="max-w-md rounded-card py-6">
        <form onSubmit={saveProfile}>
          <CardContent className="grid gap-2">
            <div className="flex min-w-0 items-center gap-4">
              <UserAvatar name={currentName} size="xl" />
              <div className="flex min-w-0 flex-1 flex-col">
                <NameField
                  currentName={currentName}
                  isEditingProfile={isEditingProfile}
                  draftName={draftName}
                  onDraftNameChange={setDraftName}
                  isSavingProfile={isSavingProfile}
                />
                {!isEditingProfile && (
                  <p data-testid={DATA_TEST_ID.PROFILE_ROLE_SUBTITLE} className="text-sm text-grey-text">
                    {role ? t(ROLE_LABEL_KEYS[role]) : unknownValuePlaceholder}
                  </p>
                )}
              </div>
            </div>

            <dl className="grid min-w-0 text-sm">
              <OrganizationRow
                currentOrganization={currentOrganization}
                isEditingProfile={isEditingProfile}
                draftOrganization={draftOrganization}
                onDraftOrganizationChange={setDraftOrganization}
                isSavingProfile={isSavingProfile}
              />
              <ProfileDetail label={t("settings.profile.email")} value={user?.email ?? unknownValuePlaceholder} />
              <ProfileDetail
                label={t("settings.profile.role")}
                value={role ? t(ROLE_LABEL_KEYS[role]) : unknownValuePlaceholder}
              />
              <ProfileDetail label={t("settings.profile.dataScope")} value={describeScope(t, scope)} />
            </dl>
          </CardContent>

          <CardFooter className="border-t">
            {isEditingProfile ? (
              <div className="flex w-full gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-pill"
                  data-testid={DATA_TEST_ID.CANCEL_PROFILE_BUTTON}
                  disabled={isSavingProfile}
                  onClick={cancelEditingProfile}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  variant="brand"
                  className="flex-1 rounded-pill"
                  data-testid={DATA_TEST_ID.SAVE_PROFILE_BUTTON}
                  disabled={isSavingProfile || draftName.trim().length === 0}
                >
                  {t("common.save")}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-pill border-tabiya-blue font-bold text-tabiya-blue py-5 hover:bg-surface-wash hover:text-tabiya-blue"
                data-testid={DATA_TEST_ID.EDIT_PROFILE_BUTTON}
                onClick={startEditingProfile}
              >
                {t("settings.profile.editProfile")}
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
