export const COURIER_ALERT_LABELS = {
	traffic: "Bloqué dans le trafic",
	nobody_home: "Personne à la maison",
	no_answer: "Client ne répond pas",
	wrong_address: "Adresse introuvable",
	arrived: "Arrivé chez le client",
	returning: "Retour au restaurant",
	help: "Besoin d’aide",
} as const;

export type CourierAlertLabelKind = keyof typeof COURIER_ALERT_LABELS;

export const COURIER_ALERT_KIND_SET = new Set<string>(
	Object.keys(COURIER_ALERT_LABELS),
);
