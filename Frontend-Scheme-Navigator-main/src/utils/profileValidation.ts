import { UserProfile } from '../types';

export function getMissingMandatoryFields(profile: UserProfile): { field: string; step: number; label: string }[] {
  const missing: { field: string; step: number; label: string }[] = [];

  if (!profile.age || Number(profile.age) < 1 || Number(profile.age) > 120) {
    missing.push({ field: 'age', step: 1, label: 'Age (1–120 yrs)' });
  }
  if (!profile.gender) {
    missing.push({ field: 'gender', step: 1, label: 'Gender' });
  }
  if (!profile.state) {
    missing.push({ field: 'state', step: 2, label: 'State / Union Territory' });
  }
  if (!profile.employmentStatus && !profile.employmentType && !profile.occupation) {
    missing.push({ field: 'employment', step: 4, label: 'Occupation / Employment' });
  }

  return missing;
}
