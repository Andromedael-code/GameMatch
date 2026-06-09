import { useEffect } from "react";

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — GameMatch` : "GameMatch";

    return () => {
      document.title = "GameMatch";
    };
  }, [title]);
}
