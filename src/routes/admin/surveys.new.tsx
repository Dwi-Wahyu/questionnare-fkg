import {
	createFileRoute,
	Link,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "../../components/ui/useToast";
import { createAdminSurveyFn } from "../../server/adminSurveyFunctions";
import { getSessionFn } from "../../server/authFunctions";

export const Route = createFileRoute("/admin/surveys/new")({
	beforeLoad: async () => {
		const user = await getSessionFn();
		if (user?.role === "visitor") {
			toast.error("Anda tidak memiliki akses untuk membuat survei.");
			throw redirect({ to: "/admin/surveys" });
		}
	},
	component: CreateSurveyComponent,
});

function CreateSurveyComponent() {
	const router = useRouter();
	const bannerFileInputRef = useRef<HTMLInputElement>(null);
	const [title, setTitle] = useState("");
	const [slug, setSlug] = useState("");
	const [category, setCategory] = useState("tracer");
	const [periodType, setPeriodType] = useState<"month" | "date">("month");
	const [periodValue, setPeriodValue] = useState("");
	const [periodValueEnd, setPeriodValueEnd] = useState("");
	const [description, setDescription] = useState("");
	const [bannerUrl, setBannerUrl] = useState("");
	const [loading, setLoading] = useState(false);

	const handleTitleChange = (val: string) => {
		setTitle(val);
		// Auto slug derivation: lowercase, replaces non-alphanumeric with hyphen
		const derivedSlug = val
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "");
		setSlug(derivedSlug);
	};

	const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onloadend = () => {
				setBannerUrl(reader.result as string);
			};
			reader.readAsDataURL(file);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim() || !slug.trim()) {
			toast.error("Judul dan Slug wajib diisi");
			return;
		}

		if (!periodValue || !periodValueEnd) {
			toast.error("Periode survei mulai dan berakhir wajib diisi");
			return;
		}

		if (periodValueEnd < periodValue) {
			toast.error("Periode berakhir tidak boleh mendahului periode mulai");
			return;
		}

		setLoading(true);
		try {
			const res = await createAdminSurveyFn({
				data: {
					title,
					slug,
					category,
					description,
					bannerUrl,
					periodType,
					periodValue,
					periodValueEnd,
				},
			});

			if (res.success) {
				toast.success("Survei baru berhasil ditambahkan!");
				router.navigate({
					to: "/admin/surveys/$surveyId",
					params: { surveyId: res.surveyId.toString() },
					search: { tab: "questions" },
				});
			}
		} catch (err: any) {
			toast.error(err.message || "Gagal membuat survei baru");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="space-y-6 w-full max-w-4xl">
			{/* Breadcrumbs */}
			<nav className="text-xs font-semibold text-[#434652] flex items-center gap-1.5">
				<Link to="/admin/surveys" className="hover:text-[#002972]">
					Kelola Survey
				</Link>
				<span className="material-symbols-outlined text-xs">chevron_right</span>
				<span className="text-slate-400">Tambah Survey Baru</span>
			</nav>

			{/* Title */}
			<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
				<div className="w-full">
					<h1 className="text-3xl font-bold text-[#1a1b21] text-left w-full">
						Tambah Survey Baru
					</h1>
					<p className="text-sm text-[#434652] mt-1 text-left">
						Buat kerangka kuesioner baru. Anda dapat menyusun pertanyaan dan
						section setelah menyimpannya.
					</p>
				</div>
			</div>

			{/* Form */}
			<div className="bg-white border border-[#c4c6d4] rounded-xl p-6 shadow-sm">
				<form onSubmit={handleSubmit} className="space-y-6">
					{/* Title input */}
					<div className="flex flex-col gap-1.5">
						<label htmlFor="title" className="text-sm font-bold text-[#1a1b21]">
							Judul Kuesioner
						</label>
						<input
							type="text"
							id="title"
							value={title}
							onChange={(e) => handleTitleChange(e.target.value)}
							className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#002972] focus:ring-1 focus:ring-[#002972] focus:bg-white outline-none transition-colors"
							placeholder="Masukkan judul kuesioner (contoh: Tracer Study Alumni 2026)"
							required
							disabled={loading}
						/>
					</div>

					{/* Slug input */}
					<div className="flex flex-col gap-1.5">
						<label htmlFor="slug" className="text-sm font-bold text-[#1a1b21]">
							Slug URL
						</label>
						<div className="relative flex items-center">
							<span className="bg-slate-100 border border-r-0 border-slate-200 rounded-l-lg py-2.5 px-3.5 text-xs text-[#747683] font-semibold">
								/survey/
							</span>
							<input
								type="text"
								id="slug"
								value={slug}
								onChange={(e) => setSlug(e.target.value)}
								className="w-full bg-slate-50 border border-slate-200 rounded-r-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#002972] focus:ring-1 focus:ring-[#002972] focus:bg-white outline-none transition-colors"
								placeholder="tracer-study-alumni-2026"
								required
								disabled={loading}
							/>
						</div>
						<p className="text-xxs text-[#747683] italic">
							Slug ini digunakan sebagai link kuesioner publik.
						</p>
					</div>

					{/* Category selection */}
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="category"
							className="text-sm font-bold text-[#1a1b21]"
						>
							Kategori Survei
						</label>
						<div className="relative">
							<select
								id="category"
								value={category}
								onChange={(e) => setCategory(e.target.value)}
								className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 pr-10 text-sm text-[#1a1b21] focus:border-[#002972] focus:ring-1 focus:ring-[#002972] focus:bg-white outline-none transition-colors appearance-none cursor-pointer"
								disabled={loading}
							>
								<option value="tracer">Tracer Study Alumni</option>
								<option value="kepuasan">Survei Kepuasan &amp; Layanan</option>
							</select>
							<span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
								arrow_drop_down
							</span>
						</div>
					</div>

					{/* Periode Survei */}
					<div className="flex flex-col gap-1.5">
						<label className="text-sm font-bold text-[#1a1b21]">
							Periode Survei (Wajib Diisi)
						</label>
						<div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 w-fit">
							<button
								type="button"
								onClick={() => {
									setPeriodType("month");
									setPeriodValue("");
									setPeriodValueEnd("");
								}}
								className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${periodType === "month" ? "bg-white shadow-sm text-[#002972]" : "text-[#747683]"}`}
							>
								Bulan
							</button>
							<button
								type="button"
								onClick={() => {
									setPeriodType("date");
									setPeriodValue("");
									setPeriodValueEnd("");
								}}
								className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${periodType === "date" ? "bg-white shadow-sm text-[#002972]" : "text-[#747683]"}`}
							>
								Tanggal Spesifik
							</button>
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div className="flex flex-col gap-1">
								<span className="text-xs font-medium text-slate-500 text-left">
									Mulai
								</span>
								<input
									type={periodType === "month" ? "month" : "date"}
									value={periodValue}
									onChange={(e) => setPeriodValue(e.target.value)}
									className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#002972] focus:ring-1 focus:ring-[#002972] focus:bg-white outline-none transition-colors"
									required
									disabled={loading}
								/>
							</div>
							<div className="flex flex-col gap-1">
								<span className="text-xs font-medium text-slate-500 text-left">
									Berakhir
								</span>
								<input
									type={periodType === "month" ? "month" : "date"}
									value={periodValueEnd}
									onChange={(e) => setPeriodValueEnd(e.target.value)}
									className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#002972] focus:ring-1 focus:ring-[#002972] focus:bg-white outline-none transition-colors"
									required
									disabled={loading}
								/>
							</div>
						</div>
					</div>

					{/* Banner URL input */}
					<div className="flex flex-col gap-1.5">
						<label className="text-sm font-bold text-[#1a1b21]">
							Banner Survei (Unggah Gambar)
						</label>
						<input
							type="file"
							ref={bannerFileInputRef}
							id="bannerUrl"
							accept="image/*"
							onChange={handleBannerUpload}
							className="hidden"
						/>
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={() => bannerFileInputRef.current?.click()}
								disabled={loading}
								className="px-4 py-2 bg-[#dbe1ff] text-[#0b3e9c] hover:bg-[#002972] hover:text-white font-semibold rounded-lg text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<span className="material-symbols-outlined text-sm">
									upload
								</span>
								Pilih Gambar Banner
							</button>
							{bannerUrl && (
								<span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
									<span className="material-symbols-outlined text-sm">
										check_circle
									</span>
									Gambar terpilih
								</span>
							)}
						</div>
						{bannerUrl && (
							<div className="relative mt-2 h-40 w-full rounded-lg border border-slate-200 overflow-hidden group">
								<img
									src={bannerUrl}
									alt="Banner Preview"
									className="h-full w-full object-cover"
								/>
								<button
									type="button"
									onClick={() => {
										setBannerUrl("");
										if (bannerFileInputRef.current)
											bannerFileInputRef.current.value = "";
									}}
									className="absolute top-3 right-3 bg-white text-[#ba1a1a] p-1.5 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
								>
									<span className="material-symbols-outlined text-sm block">
										delete
									</span>
								</button>
							</div>
						)}
					</div>

					{/* Description textarea */}
					<div className="flex flex-col gap-1.5">
						<label
							htmlFor="description"
							className="text-sm font-bold text-[#1a1b21]"
						>
							Deskripsi / Kata Pengantar
						</label>
						<textarea
							id="description"
							rows={4}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-sm text-[#1a1b21] focus:border-[#002972] focus:ring-1 focus:ring-[#002972] focus:bg-white outline-none transition-colors"
							placeholder="Masukkan kalimat sambutan, instruksi singkat, atau kebijakan privasi data bagi pengisi kuesioner..."
							disabled={loading}
						/>
					</div>

					{/* Action Buttons */}
					<div className="h-px bg-slate-100 my-4"></div>
					<div className="flex justify-end gap-3">
						<Link
							to="/admin/surveys"
							className="border border-[#747683] text-[#1a1b21] hover:bg-slate-50 font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
						>
							Batal
						</Link>
						<button
							type="submit"
							disabled={loading}
							className="bg-[#002972] text-white hover:bg-[#0b3e9c] font-semibold px-6 py-2 rounded-lg text-sm shadow-sm transition-colors flex items-center gap-1"
						>
							{loading ? "Menyimpan..." : "Lanjutkan ke Editor"}
							<span className="material-symbols-outlined text-sm">
								arrow_forward
							</span>
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
