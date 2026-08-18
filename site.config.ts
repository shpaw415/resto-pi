import type { SEOPluginOptions } from "frame-master-plugin-seo";

type SiteConfigType = {
	siteUrl: string;
	SEO: SEOPluginOptions;
	frameworkConfig: {
		routesExtensions?: string[];
	};
};

export default {
	siteUrl: "https://resto-pi.example.com",
	SEO: {
		title: "Resto Pi",
		description:
			"Plateforme de gestion restaurant : commandes, catalogue et livraisons.",
		keywords: ["restaurant", "livraison", "POS", "Resto Pi"],
		author: "Resto Pi",
		canonical: "https://resto-pi.example.com",
		robots: "noindex, nofollow",
		themeColor: "#b45309",
		openGraph: {
			title: "Resto Pi",
			description:
				"Plateforme de gestion restaurant : commandes, catalogue et livraisons.",
			url: "https://resto-pi.example.com",
			type: "website",
			image: "https://resto-pi.example.com/og-image.jpg",
			site_name: "Resto Pi",
		},
		twitter: {
			card: "summary_large_image",
			site: "@restopi",
			creator: "@restopi",
			title: "Resto Pi",
			description:
				"Plateforme de gestion restaurant : commandes, catalogue et livraisons.",
			image: "https://resto-pi.example.com/twitter-image.jpg",
		},
		customTags: [],
	},
	frameworkConfig: {
		routesExtensions: [".tsx", ".jsx"],
	},
} satisfies SiteConfigType;
