import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api.js";

export default function VerifyEmail() {
  const { token } = useParams();
  const [status, setStatus] = useState("verifying"); // verifying | success | error

  useEffect(() => {
    api
      .post(`/auth/verify-email/${token}/`)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div className="mx-auto max-w-sm px-4 py-16 text-center">
      {status === "verifying" && <p className="text-gray-500">Verifying your email...</p>}
      {status === "success" && (
        <>
          <h1 className="text-2xl font-bold text-gray-900">Email verified</h1>
          <p className="mt-2 text-sm text-gray-500">Your address is confirmed. Thanks!</p>
        </>
      )}
      {status === "error" && (
        <>
          <h1 className="text-2xl font-bold text-gray-900">Link invalid or expired</h1>
          <p className="mt-2 text-sm text-gray-500">Verification links expire after 24 hours.</p>
        </>
      )}
      <Link to="/account" className="mt-6 inline-block text-sm text-brand hover:underline">
        Go to your account
      </Link>
    </div>
  );
}
