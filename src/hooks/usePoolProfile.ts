import { useState, useEffect } from "react";
import { get, set } from "idb-keyval";

export interface PoolProfile {
  name: string;
  volumeLiters: number;
  poolType: string;
  filterType: string;
  sanitizer: string;
  location: string;
  usageFrequency: string;
}

export const DEFAULT_PROFILE: PoolProfile = {
  name: "Home Deluxe Spa DROP",
  volumeLiters: 950,
  poolType: "Whirlpool / Spa",
  filterType: "Kartuschenfilter",
  sanitizer: "Chlor (Granulat)",
  location: "Vollsonnig (>6h)",
  usageFrequency: "Täglich",
};

export function usePoolProfile() {
  const [profile, setProfileState] = useState<PoolProfile>(DEFAULT_PROFILE);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    get<PoolProfile>("pool_profile").then((saved) => {
      if (saved) setProfileState(saved);
      setProfileLoaded(true);
    });
  }, []);

  const saveProfile = async (p: PoolProfile) => {
    setProfileState(p);
    await set("pool_profile", p);
  };

  return { profile, profileLoaded, saveProfile };
}
