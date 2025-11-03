// Partner color mapping based on order
export const partnerColors = [
  { bg: "bg-green-100", text: "text-green-700", border: "border-green-600" }, // Partner 1
  { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-600" }, // Partner 2
  { bg: "bg-red-100", text: "text-red-700", border: "border-red-600" }, // Partner 3
  { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-600" }, // Partner 4
  { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-600" }, // Partner 5
  { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-600" }, // Partner 6
  { bg: "bg-rose-900/20", text: "text-rose-900", border: "border-rose-900" }, // Partner 7 (burgundy)
  { bg: "bg-amber-900/20", text: "text-amber-900", border: "border-amber-900" }, // Partner 8 (brown)
];

export const getPartnerColor = (partnerIndex: number) => {
  return partnerColors[partnerIndex % partnerColors.length];
};
