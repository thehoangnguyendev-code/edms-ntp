import { useEffect, useState } from "react";
import { api } from "@/services/api/client";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { Button } from "@/components/ui/button/Button";
import { useToast } from "@/components/ui/toast/Toast";
import { networkAccessPayload, type NetworkAccessDraft } from "../useNetworkAccessDraft";
import { tr } from "@/i18n";

type User = { id: string; fullName: string };
type AddressCheck = {
  address: string;
  allowed: boolean;
  recoveryDisabled: boolean;
};
interface NetworkAccessPanelProps {
  value: NetworkAccessDraft | null;
  onChange: (value: NetworkAccessDraft) => void;
  failed: boolean;
}

export function NetworkAccessPanel({ value, onChange, failed }: NetworkAccessPanelProps) {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [checking, setChecking] = useState(false);
  const [address, setAddress] = useState<AddressCheck | null>(null);
  const { showToast } = useToast();
  const searchUsers = async (search: string): Promise<SelectOption[]> => {
    const response = await api.get<User[]>(
      "/settings/network-access/emergency-users",
      { params: { search } },
    );
    return response.data.map((user) => ({
      value: user.id,
      label: user.fullName,
    }));
  };
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const users = await searchUsers(value?.emergencyUserId ?? "");
        if (active) setOptions(users);
      } catch {
        // The current policy remains editable; Select can retry its server search.
      }
    })();
    return () => {
      active = false;
    };
  }, [value?.emergencyUserId]);
  // How the server sees this computer under the proxies and networks typed here (nothing is saved): checked before the policy is turned on, so that the administrator is not locked out.
  const checkAddress = async () => {
    if (!value) return;
    setChecking(true);
    try {
      const response = await api.post<AddressCheck>(
        "/settings/network-access/check-address",
        networkAccessPayload(value),
      );
      setAddress(response.data);
    } catch (error: unknown) {
      setAddress(null);
      const message = (error as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      showToast({
        type: "error",
        title: tr("Unable to check the address"),
        message: message ?? "Check the allowed networks and trusted proxies.",
      });
    } finally {
      setChecking(false);
    }
  };
  const inputClass =
    "mt-1.5 h-48 resize-none overflow-y-auto w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{tr("Administrative Network Access")}</h3>
      {failed ? (
        <p role="alert" className="text-sm text-red-600">
          {tr("Unable to load network policy.")}
        </p>
      ) : !value ? (
        <p className="text-sm text-slate-500">{tr("Loading network policy…")}</p>
      ) : (
        <div className="space-y-4">
          <Checkbox
            label={tr("Restrict administrative access by network")}
            checked={value.enabled}
            onChange={(enabled) => onChange({ ...value, enabled })}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              {tr("Allowed networks (CIDR, one per line)")}
              <textarea
                value={value.allowedNetworks}
                onChange={(e) => onChange({ ...value, allowedNetworks: e.target.value })}
                placeholder="192.168.1.0/24"
                className={inputClass}
              />
            </label>
            <label className="text-sm text-slate-700">
              {tr("Trusted proxies (CIDR, one per line)")}
              <textarea
                value={value.trustedProxies}
                onChange={(e) => onChange({ ...value, trustedProxies: e.target.value })}
                placeholder={tr("Leave blank for direct connections")}
                className={inputClass}
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Select
              label={tr("Emergency Account")}
              value={value.emergencyUserId ?? ""}
              options={options}
              onSearch={searchUsers}
              onChange={(id) =>
                onChange({ ...value, emergencyUserId: id || null })
              }
              placeholder={tr("Select an active configuration administrator")}
            />
            <p className="mt-1 text-xs text-slate-500">
              {tr("The emergency account bypasses the network restriction and still requires authentication and permissions. Replace it before removing its access or deactivating it.")}
            </p>
          </div>
          </div>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-800">
              {tr("Check Before Saving")}
            </p>
            <p className="text-xs text-slate-600">
              {tr("Shows the address that the server sees for this computer, and whether the networks typed above let it in. Nothing is saved.")}
            </p>
            <Button
              size="sm"
              variant="outline-emerald"
              onClick={() => void checkAddress()}
              loading={checking}
            >
              {tr("Check My Address")}
            </Button>
            {address && (
              <p
                role="status"
                className={`text-sm ${address.allowed ? "text-emerald-700" : "text-amber-800"}`}
              >
                {tr("Your address:")} <strong>{address.address}</strong>.{" "}
                {address.allowed
                  ? tr("It is inside the allowed networks.")
                  : tr("It is outside the allowed networks: you would be blocked unless you are the emergency account.")}
                {address.recoveryDisabled &&
                  ` ${tr("The restriction is currently switched off on the server (recovery setting).")}`}
              </p>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {tr("If everyone is locked out: set")}{" "}
            <code>APP_ADMIN_NETWORK_RECOVERY_DISABLE=true</code> {tr("in the server environment and restart the backend, correct the policy here, then remove the setting.")}
          </p>
        </div>
      )}
    </div>
  );
}
