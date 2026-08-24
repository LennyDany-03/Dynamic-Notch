import Community from "@/components/site/Community";
import DownloadSection from "@/components/site/DownloadSection";
import Faq from "@/components/site/Faq";
import Features from "@/components/site/Features";
import Hero from "@/components/site/Hero";
import HowItWorks from "@/components/site/HowItWorks";
import LittleThings from "@/components/site/LittleThings";
import Origin from "@/components/site/Origin";
import Preferences from "@/components/site/Preferences";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import UnderTheHood from "@/components/site/UnderTheHood";
import WhatsNew from "@/components/site/WhatsNew";
import { getReleases } from "@/lib/changelog";
import { activeSocials, site } from "@/lib/site";

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
  sameAs: activeSocials.map((social) => social.href),
};

export default function Home() {
  const releases = getReleases();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Origin />
        <Features />
        <LittleThings />
        <Preferences />
        <HowItWorks />
        <UnderTheHood />
        <DownloadSection />
        <Community />
        <Faq />
      </main>
      <SiteFooter />
      <WhatsNew releases={releases} />
    </>
  );
}
