import { useEffect, useRef, useState } from "react";
import { Button, Card, Result, Spin, message } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";

type VerifyResponse = {
  status: number;
  message?: string;
  data?: {
    task?: string;
  }
};

type Status = "idle" | "fetching" | "ready" | "verifying" | "success" | "error";

function VerifyPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [task, setTask] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setErrorMsg("Missing verification token");
      return;
    }

    const fetchInfo = async () => {
      setStatus("fetching");
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        const { data } = await api.get<VerifyResponse>(
            `/verify/info?token=${token}`,
            { headers: { Accept: "application/json" } }
        );
        setTask(data.data?.task || "unknown");
        setStatus("ready");
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setErrorMsg(error.response?.data?.message || "Invalid or expired token");
        setStatus("error");
      }
    };
    
    fetchInfo();
  }, [searchParams]);

  const handleVerify = async () => {
    const token = searchParams.get("token");
    setStatus("verifying");
    try {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const { data } = await api.get<VerifyResponse>(
            `/verify?token=${token}`,
            { headers: { Accept: "application/json" } }
        );
        message.success(data?.message || "Verified successfully");
        setStatus("success");
    } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setErrorMsg(error.response?.data?.message || "Verification failed");
        setStatus("error");
    }
  };

  const getTaskDescription = (t: string) => {
      switch(t) {
          case "register": return "Verify your email address for account registration";
          case "change_email": return "Confirm change of email address";
          case "reset_password": return "Confirm password reset";
          default: return "confirm this action";
      }
  };
  const content = () => {
    if (status === "fetching") {
      return (
        <Result
          status="info"
          title="Checking link..."
          extra={<Spin size="large" />}
        />
      );
    }

    if (status === "ready") {
        return (
          <Result
            status="info"
            title="Last step"
            subTitle={`Please click below to confirm ${getTaskDescription(task)}`}
            extra={
              <Button type="primary" size="large" onClick={handleVerify}>
                Verify Now
              </Button>
            }
          />
        );
    }

    if (status === "verifying") {
        return (
          <Result
            title="Verifying..."
            extra={<Spin size="large" />}
          />
        );
    }

    if (status === "success") {
      const type = task === "reset_password" ? "Password reset" : "Verified";
      return (
        <Result
          status="success"
          title={`${type} successfully`}
          subTitle="You can now sign in with your updated credentials"
          extra={
            <Button
              type="primary"
              onClick={() => navigate("/login", { replace: true })}
              size="large"
            >
              Go to login
            </Button>
          }
        />
      );
    }

    return (
      <Result
        status="error"
        title="Verification failed"
        subTitle={errorMsg || "The verification link is invalid or expired."}
        extra={
          <Button type="primary" onClick={() => navigate("/login") } size="large">
            Back to login
          </Button>
        }
      />
    );
  };

  return <Card className="max-w-[640px] w-full shadow-2xl">{content()}</Card>;
}

export default VerifyPage;
