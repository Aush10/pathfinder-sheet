import React from 'react';

interface AppleEyeIconProps {
  className?: string;
  isSeeking?: boolean;
}

/**
 * Cute "Eye inside of an Apple" icon for the AI Seek / SOT Lookup button.
 * Combines a crisp apple silhouette (with stem and leaf) and a watchful inner eye.
 */
export const AppleEyeIcon: React.FC<AppleEyeIconProps> = ({
  className = 'w-4 h-4',
  isSeeking = false,
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${isSeeking ? 'animate-pulse' : ''}`}
      aria-hidden="true"
    >
      {/* Apple Stem */}
      <path
        d="M12 5.2C12 3.6 13.1 2.2 14.6 1.8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {/* Cute Apple Leaf */}
      <path
        d="M12.2 4.3C10.2 2.4 7.8 2.6 7.4 4.1C9.1 4.9 10.8 4.8 12.2 4.3Z"
        fill="currentColor"
        fillOpacity="0.35"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Apple Body Silhouette */}
      <path
        d="M12 6.2C9.8 5.2 6.2 5.8 4.6 8.5C2.9 11.4 3.5 16.2 6.1 19.3C7.5 21 9.2 21.8 10.6 21.2C11.2 20.9 11.6 20.7 12 20.7C12.4 20.7 12.8 20.9 13.4 21.2C14.8 21.8 16.5 21 17.9 19.3C20.5 16.2 21.1 11.4 19.4 8.5C17.8 5.8 14.2 5.2 12 6.2Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      {/* Outer Eye Almond Contour inside the Apple */}
      <path
        d="M6.5 13.3C7.9 10.7 9.9 9.5 12 9.5C14.1 9.5 16.1 10.7 17.5 13.3C16.1 15.9 14.1 17.1 12 17.1C9.9 17.1 7.9 15.9 6.5 13.3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Iris / Pupil */}
      <circle
        cx="12"
        cy="13.3"
        r="2.1"
        fill="currentColor"
      />
      {/* Cute Eye Glint */}
      <circle
        cx="12.7"
        cy="12.6"
        r="0.65"
        fill="#ffffff"
      />
    </svg>
  );
};
