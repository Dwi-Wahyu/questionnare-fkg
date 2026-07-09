import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import * as yup from "yup";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { toast } from "../components/ui/useToast";
import { getSessionFn, loginFn } from "../server/authFunctions";

export const Route = createFileRoute("/login")({
	beforeLoad: async () => {
		// If user is already authenticated, redirect to their proper dashboard
		const user = await getSessionFn();
		if (user) {
			if (user.role === "admin" || user.role === "visitor") {
				throw redirect({ to: "/admin" });
			}
			throw redirect({ to: "/" });
		}
	},
	component: LoginComponent,
});

const loginSchema = yup.object().shape({
	username: yup.string().required("Username wajib diisi"),
	password: yup.string().required("Password wajib diisi"),
});

function LoginComponent() {
	const router = useRouter();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setErrors({});
		setLoading(true);

		try {
			await loginSchema.validate({ username, password }, { abortEarly: false });

			const response = await loginFn({ data: { username, password } });

			if (response.success) {
				toast.success(`Selamat datang kembali, ${response.user.username}!`);
				// Clear inputs
				setUsername("");
				setPassword("");

				// Invalidate router cache to update navigation/session layout
				await router.invalidate();

				if (
					response.user.role === "admin" ||
					response.user.role === "visitor"
				) {
					router.navigate({ to: "/admin" });
				} else {
					router.navigate({ to: "/" });
				}
			}
		} catch (err: any) {
			if (err instanceof yup.ValidationError) {
				const validationErrors: Record<string, string> = {};
				for (const error of err.inner) {
					if (error.path) {
						validationErrors[error.path] = error.message;
					}
				}
				setErrors(validationErrors);
			} else {
				toast.error(err.message || "Username atau password salah");
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="login-page rect-grid-bg">
			<div className="bg-blob"></div>
			<div className="bg-blob-2"></div>

			<div
				className="card"
				style={{
					width: "100%",
					maxWidth: "520px",
					zIndex: 1,
					position: "relative",
				}}
			>
				<span className="badge">Autentikasi</span>
				<h1>Masuk Akun</h1>
				<p className="subtitle">
					Silakan masuk untuk melanjutkan ke Dashboard Tracer Study & Survey
				</p>

				<form onSubmit={handleSubmit}>
					<Input
						id="username"
						label="Username"
						type="text"
						placeholder="Masukkan username (contoh: admin)"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						error={errors.username}
						disabled={loading}
					/>

					<Input
						id="password"
						label="Password"
						type="password"
						placeholder="Masukkan password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						error={errors.password}
						disabled={loading}
					/>

					<Button
						type="submit"
						variant="primary"
						className="w-full mt-4"
						disabled={loading}
					>
						{loading ? "Memproses..." : "Masuk"}
					</Button>
				</form>

				<div className="mt-6 text-center">
					<p className="text-secondary" style={{ fontSize: "0.85rem" }}>
						Gunakan kredensial berikut untuk masuk:
					</p>
					<div
						className="mt-4 flex justify-between text-secondary"
						style={{ fontSize: "0.8rem" }}
					>
						<span>
							Admin: <strong>admin</strong> / _Admin123_
						</span>
						<span>
							Visitor: <strong>visitor</strong> / visitor123
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
