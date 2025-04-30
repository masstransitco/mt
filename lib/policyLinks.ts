/**
 * Opens the policy page in a new browser window
 * @param type - The type of policy to display ('privacy' or 'terms')
 */
export function openPolicyPage(type: 'privacy' | 'terms'): void {
  if (typeof window === 'undefined') return; // Guard for server-side rendering
  
  // Create the URL with the appropriate tab selected
  const baseUrl = window.location.origin;
  const policyUrl = `${baseUrl}/policy?tab=${type}`;
  
  // Open the policy page in a new window or tab
  window.open(policyUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Handles the click event for policy links
 * @param e - The click event
 * @param type - The type of policy to display ('privacy' or 'terms')
 */
export function handlePolicyLinkClick(
  e: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
  type: 'privacy' | 'terms'
): void {
  e.preventDefault();
  openPolicyPage(type);
}