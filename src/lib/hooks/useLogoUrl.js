import { useState, useEffect } from "react";
import { settingsService } from "../services/settingsService";

export function useLogoUrl() {
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    settingsService.getLogo().then((url) => {
      if (url) setLogoUrl(url);
    }).catch(() => {});
  }, []);

  return logoUrl;
}
