import React from "react";

export type ChevronUpProps = React.SVGProps<SVGSVGElement>;

export const ChevronUp: React.FC<ChevronUpProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M18 15L12 9L6 15" />
  </svg>
);

export default ChevronUp;
