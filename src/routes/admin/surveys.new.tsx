import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { createAdminSurveyFn } from "../../server/adminSurveyFunctions";
import { toast } from "../../components/ui/useToast";

export const Route = createFileRoute("/admin/surveys/new")({
	component: CreateSurveyComponent,
});

function CreateSurveyComponent() {
	const router = useRouter();
	const [title, setTitle] = useState("");
	const [slug, setSlug] = useState("");
	const [category, setCategory] = useState("tracer");
	const [description, setDescription] = useState("");
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

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim() || !slug.trim()) {
			toast.error("Judul dan Slug wajib diisi");
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
		<div className="space-y-6 max-w-2xl">
			{/* Breadcrumbs */}
			<nav className="text-xs font-semibold text-[#434652] flex items-center gap-1.5">
				<Link to="/admin/surveys" className="hover:text-[#002972]">
					Kelola Survey
				</Link>
				<span className="material-symbols-outlined text-xs">chevron_right</span>
				<span className="text-slate-400">Tambah Survey Baru</span>
			</nav>

			{/* Title */}
			<div>
				<h1 className="text-2xl font-bold text-[#1a1b21]">
					Tambah Survey Baru
				</h1>
				<p className="text-sm text-[#434652] mt-1">
					Buat kerangka kuesioner baru. Anda dapat menyusun pertanyaan dan
					section setelah menyimpannya.
				</p>
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
