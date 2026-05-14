"use client";

import PropTypes from "prop-types";
import Card from "./Card";

export default function NoAuthProxyCard({ providerId }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-primary">bolt</span>
        <div>
          <h2 className="text-lg font-semibold">No-auth provider</h2>
          <p className="mt-1 text-sm text-text-muted">
            {providerId} does not require API key connections. Proxy pool management has been removed from this sandbox build.
          </p>
        </div>
      </div>
    </Card>
  );
}

NoAuthProxyCard.propTypes = {
  providerId: PropTypes.string.isRequired,
};
