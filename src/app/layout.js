import "./globals.css";

export const metadata = {
  title: "AC Accreditation Portal",
  description: "Apply for, review, and issue assessment center accreditation.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
