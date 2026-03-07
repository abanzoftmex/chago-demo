import { useState, useEffect, useMemo } from "react";
import { settingsService } from "../services/settingsService";
import { useAuth } from "../../context/AuthContextMultiTenant";

export function useLogoUrl() {
  const { tenantInfo } = useAuth();
  const tenantId = useMemo(() => tenantInfo?.id, [tenantInfo?.id]);
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    if (!tenantId) return;
    settingsService.getLogo(tenantId).then((url) => {
      if (url) setLogoUrl(url);
    }).catch(() => {});
  }, [tenantId]);

  return logoUrl;
}
