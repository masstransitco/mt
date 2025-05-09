import React from 'react';

export type QrCodeIconProps = React.SVGProps<SVGSVGElement>;

export const QrCodeIcon: React.FC<QrCodeIconProps> = (props) => {
  return (
    <svg
      // Make sure to merge in any passed props such as className, style, etc.
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M18 15L18 18H14L14 15L18 15Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1.5 1.49994H9.1306V3.40903H3.40909V9.13054H1.5V1.49994ZM20.5909 3.40903H14.8694V1.49994H22.5V9.13054H20.5909V3.40903ZM22.5 14.8693V22.4999H14.8694V20.5908H20.5909V14.8693H22.5ZM1.5 14.8693H3.40909V20.5908H9.1306V22.4999H1.5V14.8693Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 12V6H14V13C14 13.5523 13.5523 14 13 14H6V12H12Z"
        fill="currentColor"
      />
      <path
        d="M10 6L10 10H6L6 6L10 6Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11 18H6V16H11V18Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16 12L16 10L18 10L18 12L16 12Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16 8L16 6L18 6L18 8L16 8Z"
        fill="currentColor"
      />
    </svg>
  );
};
