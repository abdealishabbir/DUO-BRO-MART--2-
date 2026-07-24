// Pakistan provinces + their major cities, used to drive dependent
// province -> city dropdowns anywhere an address is collected
// (checkout shipping, account addresses, vendor pickup address, etc).
// Keep this as the single source of truth so the list never drifts
// between forms.

export const PROVINCES = [
  ["punjab", "Punjab"],
  ["sindh", "Sindh"],
  ["khyber_pakhtunkhwa", "Khyber Pakhtunkhwa"],
  ["balochistan", "Balochistan"],
  ["gilgit_baltistan", "Gilgit-Baltistan"],
  ["azad_kashmir", "Azad Kashmir"],
  ["islamabad_ct", "Islamabad Capital Territory"],
];

export const CITIES_BY_PROVINCE = {
  punjab: [
    "Lahore", "Faisalabad", "Rawalpindi", "Multan", "Gujranwala", "Sialkot",
    "Bahawalpur", "Sargodha", "Sheikhupura", "Jhang", "Rahim Yar Khan",
    "Gujrat", "Kasur", "Okara", "Sahiwal", "Wah Cantonment", "Dera Ghazi Khan",
    "Chiniot", "Muzaffargarh", "Vehari",
  ],
  sindh: [
    "Karachi", "Hyderabad", "Sukkur", "Larkana", "Nawabshah", "Mirpurkhas",
    "Jacobabad", "Shikarpur", "Dadu", "Thatta", "Badin", "Khairpur",
    "Ghotki", "Tando Allahyar", "Tando Adam",
  ],
  khyber_pakhtunkhwa: [
    "Peshawar", "Mardan", "Mingora", "Kohat", "Abbottabad", "Dera Ismail Khan",
    "Bannu", "Swabi", "Nowshera", "Charsadda", "Haripur", "Chitral",
  ],
  balochistan: [
    "Quetta", "Gwadar", "Turbat", "Khuzdar", "Chaman", "Sibi", "Zhob",
    "Hub", "Dera Bugti", "Nushki",
  ],
  gilgit_baltistan: [
    "Gilgit", "Skardu", "Hunza", "Ghanche", "Astore", "Diamer",
  ],
  azad_kashmir: [
    "Muzaffarabad", "Mirpur", "Rawalakot", "Kotli", "Bagh", "Bhimber",
  ],
  islamabad_ct: [
    "Islamabad",
  ],
};

export function citiesFor(province) {
  return CITIES_BY_PROVINCE[province] ?? [];
}
