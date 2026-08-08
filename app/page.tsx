import DownloadSection from "@/components/site/DownloadSection";
import Faq from "@/components/site/Faq";
import Features from "@/components/site/Features";
import Hero from "@/components/site/Hero";
import HowItWorks from "@/components/site/HowItWorks";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import UnderTheHood from "@/components/site/UnderTheHood";
import WhatsNew from "@/components/site/WhatsNew";
import { getReleases } from "@/lib/changelog";
import { site } from "@/lib/site";

/*
  SoftwareApplication markup is what earns the download-style rich result on a
  search page — price, platform and category are the fields Google reads.
*/
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: site.name,
  description: site.description,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Windows 10, Windows 11",
  softwareVersion: site.version,
  downloadUrl: site.download,
  url: site.url,
  license: "https://opensource.org/licenses/MIT",
  author: { "@type": "Person", name: site.author, url: site.authorUrl },
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function Home() {
  /*
    Read on the server at build time. The dialog is a Client Component, so the
    parsed notes travel down as props rather than the changelog being fetched.
  */
  const releases = getReleases();

  return (
    <>
      <script
        type="application/ld+json"
        // Static, author-controlled object — nothing user-supplied reaches this.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <UnderTheHood />
        <DownloadSection />
        <Faq />
      </main>
      <SiteFooter />
      <WhatsNew releases={releases} />
    </>
  );
}
