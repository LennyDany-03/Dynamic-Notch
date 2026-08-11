import Community from "@/components/site/Community";
import DownloadSection from "@/components/site/DownloadSection";
import Faq from "@/components/site/Faq";
import Features from "@/components/site/Features";
import Hero from "@/components/site/Hero";
import HowItWorks from "@/components/site/HowItWorks";
import Preferences from "@/components/site/Preferences";
import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import UnderTheHood from "@/components/site/UnderTheHood";
import WhatsNew from "@/components/site/WhatsNew";
import { getReleases } from "@/lib/changelog";
import { activeSocials, site } from "@/lib/site";

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
  /*
    `sameAs` is how a search engine ties the Discord server and the social
    accounts to this app rather than treating them as unrelated pages. Built
    from the same filtered list the footer draws, so an account with no handle
    yet is left out of the markup too.
  */
  sameAs: activeSocials.map((social) => social.href),
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
        {/*
          Settings comes after the panels and before the mechanics: it answers
          "can I make it behave the way I want" while the reader is still
          deciding, which is earlier than "how is it built".
        */}
        <Preferences />
        <HowItWorks />
        <UnderTheHood />
        <DownloadSection />
        {/* After the download — joining is what happens once you have it. */}
        <Community />
        <Faq />
      </main>
      <SiteFooter />
      <WhatsNew releases={releases} />
    </>
  );
}
