import useSWR from "swr";
import { useMemo } from "react";
import { settingsService } from "../services/settingsService";
import { useAuth } from "../../context/AuthContextMultiTenant";

const logoFetcher = (tenantId) => settingsService.getLogo(tenantId);

export function useLogoUrl() {
  const { tenantInfo } = useAuth();
  const tenantId = useMemo(() => tenantInfo?.id, [tenantInfo?.id]);

  const { data: logoUrl } = useSWR(
    tenantId ? ["logo", tenantId] : null,
    ([, id]) => logoFetcher(id),
    { revalidateOnFocus: false }
  );

  return logoUrl ?? null;
}
