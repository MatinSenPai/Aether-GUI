import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { PANEL_INPUT } from "@/components/settings/SettingsPrimitives"
import { isLocked } from "@/lib/connectionView"
import { useConnectionStore } from "@/state/connectionStore"

/** Aether 1.5.0's Cloudflare Zero Trust enrolment controls. Credentials stay
 * only in the running webview/backend process and are scrubbed before the
 * last-successful profile is written to disk. */
export function ZeroTrustSettings() {
  const profile = useConnectionStore((s) => s.profile)
  const status = useConnectionStore((s) => s.status)
  const setTeam = useConnectionStore((s) => s.setZeroTrustTeam)
  const setAuth = useConnectionStore((s) => s.setZeroTrustAuth)
  const setEmail = useConnectionStore((s) => s.setAccessEmail)
  const setClientId = useConnectionStore((s) => s.setAccessClientId)
  const setClientSecret = useConnectionStore((s) => s.setAccessClientSecret)
  const setToken = useConnectionStore((s) => s.setAccessToken)
  const setGateway = useConnectionStore((s) => s.setZeroTrustGateway)
  const locked = isLocked(status)
  const enabled = profile.zero_trust_team.trim().length > 0

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs leading-normal text-muted-foreground">
        Connect as a managed device instead of anonymous consumer WARP. Leave
        the team empty for normal one-click mode.
      </p>
      <input
        type="text"
        value={profile.zero_trust_team}
        disabled={locked}
        onChange={(e) => setTeam(e.target.value)}
        placeholder="Team name (for example: acme)"
        className={PANEL_INPUT}
        aria-label="Cloudflare Zero Trust team name"
      />
      {enabled && (
        <>
          <Select
            value={profile.zero_trust_auth}
            onValueChange={setAuth}
            disabled={locked}
          >
            <SelectTrigger size="sm" className="w-full text-xs">
              <SelectValue placeholder="Sign-in method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email one-time code</SelectItem>
              <SelectItem value="service">Service token</SelectItem>
              <SelectItem value="token">Existing access token</SelectItem>
            </SelectContent>
          </Select>
          {profile.zero_trust_auth === "email" && (
            <input
              type="email"
              value={profile.access_email}
              disabled={locked}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email for the one-time code"
              className={PANEL_INPUT}
              aria-label="Zero Trust email"
            />
          )}
          {profile.zero_trust_auth === "service" && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={profile.access_client_id}
                disabled={locked}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Client ID"
                className={PANEL_INPUT}
                aria-label="Access service-token client ID"
              />
              <input
                type="password"
                value={profile.access_client_secret}
                disabled={locked}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Client secret"
                className={PANEL_INPUT}
                aria-label="Access service-token client secret"
              />
            </div>
          )}
          {profile.zero_trust_auth === "token" && (
            <input
              type="password"
              value={profile.access_token}
              disabled={locked}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enrollment access token (JWT)"
              className={PANEL_INPUT}
              aria-label="Zero Trust enrollment access token"
            />
          )}
          <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5">
            <p className="text-xs leading-snug text-muted-foreground">
              Route HTTP/HTTPS through the organization&apos;s Gateway proxy —
              it can apply your organization&apos;s filtering and logging.
            </p>
            <div className="ml-auto shrink-0">
              <Switch
                checked={profile.zero_trust_gateway}
                onCheckedChange={setGateway}
                disabled={locked}
                aria-label="Use organization Gateway proxy"
              />
            </div>
          </div>
          <p className="text-[11px] leading-normal text-faint">
            Credentials are used only for this session and are never saved to
            disk.
          </p>
        </>
      )}
    </div>
  )
}
