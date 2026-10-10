export interface ExplorePersonal {
  signedIn: boolean;
  hasResult: boolean;
  /** Expected Thanaweya score in percent. */
  expectedScorePct: number | null;
  track: string | null;
  curriculum: string | null;
  budget: 'low' | 'medium' | 'high' | null;
  /** Governorate id from the profile. */
  governorate: string | null;
  topCareerIds: string[];
  /** "kind:id" refs. */
  saved: string[];
  savedLocked: 'consent_required' | 'unavailable' | null;
}

export const EMPTY_EXPLORE_PERSONAL: ExplorePersonal = {
  signedIn: false,
  hasResult: false,
  expectedScorePct: null,
  track: null,
  curriculum: null,
  budget: null,
  governorate: null,
  topCareerIds: [],
  saved: [],
  savedLocked: null,
};
