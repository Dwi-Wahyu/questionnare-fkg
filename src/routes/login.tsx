import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import * as yup from "yup";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { toast } from "../components/ui/useToast";
import { getSessionFn, loginFn } from "../server/authFunctions";
import { CircleUser } from "lucide-react";

export const Route = createFileRoute("/login")({
	beforeLoad: async () => {
		// If user is already authenticated, redirect to their proper dashboard
		const user = await getSessionFn();
		if (user) {
			if (user.role === "admin") {
				throw redirect({ to: "/admin" });
			}
			if (user.role === "visitor") {
				throw redirect({ to: "/admin/surveys" });
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

				if (response.user.role === "admin") {
					router.navigate({ to: "/admin" });
				} else if (response.user.role === "visitor") {
					router.navigate({ to: "/admin/surveys" });
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

	const handleGuestLogin = async () => {
		setErrors({});
		setLoading(true);

		try {
			const response = await loginFn({
				data: { username: "visitor", password: "visitor123" },
			});

			if (response.success) {
				toast.success(`Berhasil masuk sebagai Tamu!`);
				setUsername("");
				setPassword("");
				await router.invalidate();
				router.navigate({ to: "/admin/surveys" });
			}
		} catch (err: any) {
			toast.error(err.message || "Gagal masuk sebagai tamu");
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
					maxWidth: "440px",
					zIndex: 1,
					position: "relative",
					background: "rgba(255, 255, 255, 0.85)",
					backdropFilter: "blur(12px)",
					WebkitBackdropFilter: "blur(12px)",
				}}
			>
				<div className="flex flex-col items-center">
					<span className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#3D6FC2]/25 text-[#0B3E9C] text-xs font-bold mb-4">
						Portal Masuk
					</span>
					<h1 className="text-3xl md:text-4xl font-extrabold text-[#1a1b21] tracking-tight text-center mb-2">
						Selamat Datang
					</h1>
					<p className="subtitle text-sm text-[#434652] text-center w-full mb-6">
						Masuk untuk melanjutkan ke Dashboard Tracer Study & Survey FKG Unhas
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
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
						className="w-full mt-2"
						style={{
							padding: "14px 20px",
							fontSize: "0.95rem",
							borderRadius: "var(--radius-xl)",
						}}
						disabled={loading}
					>
						{loading ? "Memproses..." : "Masuk"}
					</Button>
				</form>

				<div className="mt-4">
					<div className="flex items-center gap-4 my-6">
						<div className="flex-1 h-px bg-slate-200/80"></div>
						<span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">
							ATAU
						</span>
						<div className="flex-1 h-px bg-slate-200/80"></div>
					</div>

					<Button
						type="button"
						variant="secondary"
						className="w-full flex items-center justify-center gap-2"
						style={{
							padding: "12px 20px",
							fontSize: "0.95rem",
							borderRadius: "var(--radius-xl)",
						}}
						disabled={loading}
						onClick={handleGuestLogin}
					>
						<CircleUser className="h-5 w-5" />
						Masuk Sebagai Tamu
					</Button>
				</div>
			</div>
		</div>
	);
}
