import React from "react";

export type MapPinDownProps = React.SVGProps<SVGSVGElement>;

export const MapPinDown: React.FC<MapPinDownProps> = (props) => (
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
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
    <path d="M12.736 21.345a2 2 0 0 1 -2.149 -.445l-4.244 -4.243a8 8 0 1 1 13.59 -4.624" />
    <path d="M19 16v6" />
    <path d="M22 19l-3 3l-3 -3" />
  </svg>
);

export default MapPinDown;
