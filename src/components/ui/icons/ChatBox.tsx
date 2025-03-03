import React from "react";

export type ChatBoxProps = React.SVGProps<SVGSVGElement>;

export const ChatBox: React.FC<ChatBoxProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
    fill="currentColor"
    {...props}
  >
    <path d="M232,64V192a16,16,0,0,1-16,16H83l-32.6,28.16-.09.07A15.89,15.89,0,0,1,40,240a16.05,16.05,0,0,1-6.79-1.52A15.84,15.84,0,0,1,24,224V64A16,16,0,0,1,40,48H216A16,16,0,0,1,232,64Z" />
  </svg>
);

export default ChatBox;
