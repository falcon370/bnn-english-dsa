const TrendingIcon = ({ isTrending, className = '' }) => {
  if (!isTrending) return null;

  return (
    <span
      className={`inline-flex items-center justify-center text-[#1A56C4] ${className}`}
      title="Trending"
      aria-label="Trending"
    >
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M4 16L10 10L13.5 13.5L20 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M15.5 7H20V11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
};

export default TrendingIcon;
