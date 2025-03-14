import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { ChevronDown, Lock, Shield, Eye, FileText, Zap, Globe, Car, Leaf, CreditCard, CalendarClock } from "lucide-react"

export default function PolicyPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-4 bg-gradient-to-r from-gray-100 to-gray-300 bg-clip-text text-transparent">
            Privacy & Terms
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            We're committed to transparency and protecting your privacy while providing sustainable mobility solutions.
          </p>
        </header>

        <Tabs defaultValue="privacy" className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="bg-gray-900/50 backdrop-blur-sm">
              <TabsTrigger value="privacy" className="text-sm">
                Privacy Policy
              </TabsTrigger>
              <TabsTrigger value="terms" className="text-sm">
                Terms of Service
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="privacy" className="mt-0">
            <div className="bg-gray-900/30 backdrop-blur-md rounded-2xl overflow-hidden border border-gray-800">
              <div className="p-6 md:p-8 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-medium">Privacy Policy</h2>
                    <p className="text-sm text-gray-400">Last updated: March 14, 2025</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="h-[600px]">
                <div className="p-6 md:p-8 space-y-12">
                  <section className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Eye className="w-4 h-4 text-blue-400" />
                      </div>
                      <h3 className="text-lg font-medium">Our Privacy Commitment</h3>
                    </div>
                    <p className="text-gray-300 leading-relaxed pl-11">
                      At AirCity, our Hong Kong-based electric vehicle transit service is built on a foundation of trust and transparency. 
                      We've designed this policy to clearly explain how we collect, use, and protect your personal information.
                      Our mission is to provide sustainable urban mobility while respecting your privacy rights.
                    </p>
                    <div className="bg-gray-800/50 rounded-xl p-4 ml-11 border border-gray-700/50">
                      <p className="text-sm text-gray-300 italic">
                        "We believe your journey data belongs to you. Our privacy practices are built on transparency, 
                        purpose limitation, and giving you control over your information."
                      </p>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-purple-400" />
                      </div>
                      <h3 className="text-lg font-medium">Information We Collect</h3>
                    </div>
                    <div className="pl-11 space-y-4">
                      <p className="text-gray-300 leading-relaxed">
                        To provide our electric vehicle services in Hong Kong, we collect the following types of information:
                      </p>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                          <h4 className="font-medium mb-2">Account Information</h4>
                          <p className="text-sm text-gray-400">
                            Name, email, phone number, payment information, driver's license details, and profile preferences.
                          </p>
                        </div>
                        <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                          <h4 className="font-medium mb-2">Usage Information</h4>
                          <p className="text-sm text-gray-400">
                            Trip data (start/end locations, routes, duration), vehicle usage, charging details, and interactions with our app.
                          </p>
                        </div>
                        <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                          <h4 className="font-medium mb-2">Device Information</h4>
                          <p className="text-sm text-gray-400">
                            Device type, IP address, operating system, language preferences, and app version.
                          </p>
                        </div>
                        <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                          <h4 className="font-medium mb-2">Location Data</h4>
                          <p className="text-sm text-gray-400">
                            GPS data while using our vehicles, pickup/dropoff locations, and nearby available vehicles.
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Car className="w-4 h-4 text-green-400" />
                      </div>
                      <h3 className="text-lg font-medium">Vehicle Telematics and Safety</h3>
                    </div>
                    <div className="pl-11 space-y-4">
                      <p className="text-gray-300 leading-relaxed">
                        Our electric vehicles collect technical and safety-related data to ensure proper operation and user safety:
                      </p>
                      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                        <ul className="space-y-2 text-gray-300">
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-green-400">•</span>
                            </div>
                            <span>Vehicle performance metrics (battery level, efficiency, charging status)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-green-400">•</span>
                            </div>
                            <span>Driving behavior (speed, acceleration, braking patterns)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-green-400">•</span>
                            </div>
                            <span>Vehicle diagnostics and maintenance data</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-green-400">•</span>
                            </div>
                            <span>Safety incident records (emergency braking, collision detection)</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-yellow-400" />
                      </div>
                      <h3 className="text-lg font-medium">How We Use Your Information</h3>
                    </div>
                    <div className="pl-11 space-y-4">
                      <p className="text-gray-300 leading-relaxed">
                        We use your information for the following purposes:
                      </p>
                      <div className="bg-gradient-to-r from-gray-800/30 to-gray-800/10 p-5 rounded-xl border border-gray-700/50">
                        <h4 className="font-medium mb-3">Core Service Purposes</h4>
                        <ul className="space-y-2 text-gray-300">
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-blue-400">1</span>
                            </div>
                            <span>To provide and manage our electric vehicle service, including user verification and vehicle access</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-blue-400">2</span>
                            </div>
                            <span>To process payments, manage subscriptions, and handle billing inquiries</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-blue-400">3</span>
                            </div>
                            <span>To optimize vehicle distribution, charging infrastructure, and service availability</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-blue-400">4</span>
                            </div>
                            <span>To improve our services, develop new features, and enhance the user experience</span>
                          </li>
                        </ul>
                      </div>
                      <div className="bg-gradient-to-r from-gray-800/30 to-gray-800/10 p-5 rounded-xl border border-gray-700/50">
                        <h4 className="font-medium mb-3">Additional Uses</h4>
                        <ul className="space-y-2 text-gray-300">
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-yellow-400">•</span>
                            </div>
                            <span>Safety and security (preventing fraud, verifying identity, ensuring safe vehicle use)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-yellow-400">•</span>
                            </div>
                            <span>Regulatory compliance (meeting Hong Kong transportation and data protection requirements)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-yellow-400">•</span>
                            </div>
                            <span>Communication (service updates, account notifications, customer support)</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                        <Globe className="w-4 h-4 text-red-400" />
                      </div>
                      <h3 className="text-lg font-medium">Data Sharing and Third Parties</h3>
                    </div>
                    <p className="text-gray-300 leading-relaxed pl-11">
                      We share your information with the following categories of third parties:
                    </p>
                    <div className="bg-gray-800/30 p-4 rounded-xl ml-11 border border-gray-700/50">
                      <ul className="space-y-3 text-gray-300">
                        <li className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center mt-0.5">
                            <span className="text-xs text-red-400">•</span>
                          </div>
                          <div>
                            <span className="font-medium">Service Providers</span>
                            <p className="text-sm text-gray-400 mt-1">Payment processors, cloud services, customer support, and analytics partners.</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center mt-0.5">
                            <span className="text-xs text-red-400">•</span>
                          </div>
                          <div>
                            <span className="font-medium">Regulatory Authorities</span>
                            <p className="text-sm text-gray-400 mt-1">Hong Kong transport authorities, law enforcement (when legally required), and safety regulators.</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center mt-0.5">
                            <span className="text-xs text-red-400">•</span>
                          </div>
                          <div>
                            <span className="font-medium">Business Partners</span>
                            <p className="text-sm text-gray-400 mt-1">Insurance providers, vehicle maintenance partners, and station/infrastructure operators.</p>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                        <Leaf className="w-4 h-4 text-indigo-400" />
                      </div>
                      <h3 className="text-lg font-medium">Data Retention and Security</h3>
                    </div>
                    <div className="pl-11 space-y-4">
                      <p className="text-gray-300 leading-relaxed">
                        We implement strong security measures to protect your data and are transparent about how long we keep your information:
                      </p>
                      <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                        <h4 className="font-medium mb-2">Data Retention</h4>
                        <p className="text-sm text-gray-400">
                          Account information is retained while your account is active and for 7 years after closure for legal and business purposes.
                          Trip data is kept for 3 years to support business operations, dispute resolution, and service improvements.
                          Vehicle telematics data is stored for 1 year to support safety, maintenance, and operational needs.
                        </p>
                      </div>
                      <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                        <h4 className="font-medium mb-2">Security Measures</h4>
                        <p className="text-sm text-gray-400">
                          We use industry-standard encryption for data transmission and storage, implement access controls,
                          conduct regular security assessments, and train our staff on data protection practices.
                          We comply with Hong Kong's Personal Data (Privacy) Ordinance and other applicable regulations.
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-yellow-400" />
                      </div>
                      <h3 className="text-lg font-medium">Your Rights and Choices</h3>
                    </div>
                    <div className="pl-11 space-y-4">
                      <p className="text-gray-300 leading-relaxed">
                        As a user of our service in Hong Kong, you have these rights regarding your personal data:
                      </p>
                      <div className="bg-gray-800/30 p-5 rounded-xl border border-gray-700/50">
                        <h4 className="font-medium mb-3">Your Data Rights</h4>
                        <ul className="space-y-2 text-gray-300">
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-yellow-400">1</span>
                            </div>
                            <span>Access and review the personal information we hold about you</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-yellow-400">2</span>
                            </div>
                            <span>Correct inaccurate or incomplete information</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-yellow-400">3</span>
                            </div>
                            <span>Request deletion of your personal data (subject to legal requirements)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-yellow-400">4</span>
                            </div>
                            <span>Restrict or object to certain processing of your data</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-yellow-400">5</span>
                            </div>
                            <span>Data portability (receive your data in a structured, machine-readable format)</span>
                          </li>
                        </ul>
                      </div>
                      <div className="bg-gray-800/30 p-5 rounded-xl border border-gray-700/50">
                        <h4 className="font-medium mb-3">Privacy Controls</h4>
                        <p className="text-sm text-gray-400 mb-3">You can manage your privacy preferences through:</p>
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            variant="outline"
                            className="bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700/50"
                          >
                            Privacy Dashboard
                          </Button>
                          <Button
                            variant="outline"
                            className="bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700/50"
                          >
                            Data Request Form
                          </Button>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Lock className="w-4 h-4 text-blue-400" />
                      </div>
                      <h3 className="text-lg font-medium">Contact Information</h3>
                    </div>
                    <div className="pl-11">
                      <p className="text-gray-300 leading-relaxed">
                        If you have questions or concerns about our privacy practices, please contact our Data Protection Officer:
                      </p>
                      <div className="mt-4 bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                        <p className="text-sm text-gray-300">
                          Email: privacy@aircityhk.com<br/>
                          Address: Central Plaza, 18 Harbour Road, Wan Chai, Hong Kong<br/>
                          Phone: +852 5555 1234
                        </p>
                      </div>
                      <p className="text-sm text-gray-400 mt-4">
                        You also have the right to lodge a complaint with the Hong Kong Privacy Commissioner for Personal Data
                        if you believe we have violated your privacy rights.
                      </p>
                    </div>
                  </section>
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="terms" className="mt-0">
            <div className="bg-gray-900/30 backdrop-blur-md rounded-2xl overflow-hidden border border-gray-800">
              <div className="p-6 md:p-8 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-medium">Terms of Service</h2>
                    <p className="text-sm text-gray-400">Last updated: March 14, 2025</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="h-[600px]">
                <div className="p-6 md:p-8 space-y-12">
                  <section className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Car className="w-4 h-4 text-blue-400" />
                      </div>
                      <h3 className="text-lg font-medium">Introduction to AirCity</h3>
                    </div>
                    <p className="text-gray-300 leading-relaxed pl-11">
                      Welcome to AirCity's electric vehicle sharing service. These Terms of Service ("Terms") govern your use of our 
                      mobile application, website, and self-service electric vehicle rental service in Hong Kong. Please read these 
                      Terms carefully before using our services.
                    </p>
                    <div className="bg-gray-800/50 rounded-xl p-4 ml-11 border border-gray-700/50">
                      <p className="text-sm text-gray-300">
                        By creating an account, downloading our app, or using our vehicles, you agree to be bound by these Terms. 
                        If you don't agree, please don't use our services. These Terms form a legally binding agreement between you 
                        and AirCity Limited, a company registered in Hong Kong.
                      </p>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-green-400" />
                      </div>
                      <h3 className="text-lg font-medium">Eligibility and Account Creation</h3>
                    </div>
                    <div className="pl-11 space-y-4">
                      <p className="text-gray-300 leading-relaxed">
                        To use our electric vehicle service, you must meet certain eligibility requirements and create an account:
                      </p>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                          <h4 className="font-medium mb-2">Eligibility</h4>
                          <p className="text-sm text-gray-400">
                            You must be at least 18 years old, hold a valid driving license recognized in Hong Kong, 
                            have a clean driving record, and meet our insurance requirements.
                          </p>
                        </div>
                        <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                          <h4 className="font-medium mb-2">Account Creation</h4>
                          <p className="text-sm text-gray-400">
                            You'll need to provide accurate personal information, verify your identity and driving credentials, 
                            and add a valid payment method to your account.
                          </p>
                        </div>
                      </div>
                      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                        <p className="text-sm text-gray-300">
                          You are responsible for maintaining the confidentiality of your account credentials and for all 
                          activity that occurs under your account. You must notify us immediately of any unauthorized use 
                          of your account or any security breach.
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                        <CalendarClock className="w-4 h-4 text-purple-400" />
                      </div>
                      <h3 className="text-lg font-medium">Vehicle Rental Terms</h3>
                    </div>
                    <div className="pl-11 space-y-4">
                      <p className="text-gray-300 leading-relaxed">
                        The following terms apply to each vehicle rental:
                      </p>
                      <div className="bg-gradient-to-r from-gray-800/30 to-gray-800/10 p-5 rounded-xl border border-gray-700/50">
                        <h4 className="font-medium mb-3">Key Terms</h4>
                        <ul className="space-y-2 text-gray-300">
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-purple-400">1</span>
                            </div>
                            <span>Your rental begins when you unlock a vehicle through our app and ends when you properly end the rental in the app after parking in a designated area.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-purple-400">2</span>
                            </div>
                            <span>You must inspect the vehicle for any damage before starting your trip and report any issues through the app.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-purple-400">3</span>
                            </div>
                            <span>You must follow all Hong Kong traffic laws and drive safely at all times.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-purple-400">4</span>
                            </div>
                            <span>You may only park vehicles in designated parking zones shown in our app. Improper parking may result in additional fees.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-purple-400">5</span>
                            </div>
                            <span>Maximum rental duration is 72 hours unless extended through the app (subject to availability).</span>
                          </li>
                        </ul>
                      </div>
                      <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                        <h4 className="font-medium mb-2">Prohibited Uses</h4>
                        <p className="text-sm text-gray-400 mb-2">
                          The following uses of our vehicles are strictly prohibited:
                        </p>
                        <ul className="space-y-1 text-sm text-gray-400">
                          <li>• Driving outside of Hong Kong SAR</li>
                          <li>• Driving under the influence of alcohol, drugs, or medication</li>
                          <li>• Using the vehicle for commercial purposes (delivery, ride-sharing, etc.)</li>
                          <li>• Transporting hazardous materials or illegal items</li>
                          <li>• Participating in races, stunts, or off-road driving</li>
                          <li>• Allowing unauthorized drivers to operate the vehicle</li>
                        </ul>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-yellow-400" />
                      </div>
                      <h3 className="text-lg font-medium">Fees and Payment</h3>
                    </div>
                    <p className="text-gray-300 leading-relaxed pl-11">
                      By using our service, you agree to pay all fees and charges associated with your vehicle rentals:
                    </p>
                    <div className="bg-gray-800/30 p-5 rounded-xl ml-11 border border-gray-700/50">
                      <h4 className="font-medium mb-3">Fee Structure</h4>
                      <ul className="space-y-3 text-gray-300">
                        <li className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center mt-0.5">
                            <span className="text-xs text-yellow-400">•</span>
                          </div>
                          <div>
                            <span className="font-medium">Standard Rental Fees</span>
                            <p className="text-sm text-gray-400 mt-1">Per-minute rates, hourly packages, or day rates as displayed in the app.</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center mt-0.5">
                            <span className="text-xs text-yellow-400">•</span>
                          </div>
                          <div>
                            <span className="font-medium">Additional Fees</span>
                            <p className="text-sm text-gray-400 mt-1">Service fees, insurance costs, reservation fees, and any applicable taxes.</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center mt-0.5">
                            <span className="text-xs text-yellow-400">•</span>
                          </div>
                          <div>
                            <span className="font-medium">Penalty Fees</span>
                            <p className="text-sm text-gray-400 mt-1">Charges for traffic violations, improper parking, late returns, excessive cleaning, or damage to the vehicle.</p>
                          </div>
                        </li>
                      </ul>
                      <div className="mt-4 pt-4 border-t border-gray-700/50">
                        <p className="text-sm text-gray-300">
                          We reserve the right to charge the payment method on file for any fees incurred during or after your rental. 
                          All fees are in Hong Kong Dollars (HKD) and include applicable taxes.
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-red-400" />
                      </div>
                      <h3 className="text-lg font-medium">Insurance and Liability</h3>
                    </div>
                    <div className="pl-11 space-y-4">
                      <p className="text-gray-300 leading-relaxed">
                        We provide insurance coverage for our vehicles, but there are important limitations:
                      </p>
                      <div className="bg-gradient-to-r from-gray-800/30 to-gray-800/10 p-5 rounded-xl border border-gray-700/50">
                        <h4 className="font-medium mb-3">Insurance Coverage</h4>
                        <ul className="space-y-2 text-gray-300">
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-red-400">•</span>
                            </div>
                            <span>Our vehicles include third-party liability insurance as required by Hong Kong law.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-red-400">•</span>
                            </div>
                            <span>Standard insurance has a deductible of HKD 5,000 for each accident or damage incident.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-red-400">•</span>
                            </div>
                            <span>Optional damage protection plans are available for purchase in the app.</span>
                          </li>
                        </ul>
                        <div className="mt-4 pt-4 border-t border-gray-700/50">
                          <p className="text-sm text-gray-300 font-medium">Your Responsibility</p>
                          <p className="text-sm text-gray-400 mt-1">
                            You are responsible for any damage to the vehicle resulting from misuse, violations of these Terms, 
                            or any circumstances not covered by our insurance. Insurance coverage may be void if you violate these Terms.
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Leaf className="w-4 h-4 text-blue-400" />
                      </div>
                      <h3 className="text-lg font-medium">Accidents and Incidents</h3>
                    </div>
                    <div className="pl-11 space-y-4">
                      <p className="text-gray-300 leading-relaxed">
                        In case of an accident, theft, or damage to the vehicle, you must:
                      </p>
                      <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                        <ul className="space-y-2 text-gray-300">
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-blue-400">1</span>
                            </div>
                            <span>Immediately notify the police if there are injuries, significant damage, or if required by law.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-blue-400">2</span>
                            </div>
                            <span>Report the incident to AirCity through our emergency hotline (available 24/7 in the app).</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-blue-400">3</span>
                            </div>
                            <span>Take photos of the scene, damage, and exchange information with other involved parties.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-blue-400">4</span>
                            </div>
                            <span>Complete an incident report through our app within 24 hours.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                              <span className="text-xs text-blue-400">5</span>
                            </div>
                            <span>Cooperate with our insurance company and provide any requested information.</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Globe className="w-4 h-4 text-green-400" />
                      </div>
                      <h3 className="text-lg font-medium">Termination and Suspension</h3>
                    </div>
                    <p className="text-gray-300 leading-relaxed pl-11">
                      We reserve the right to suspend or terminate your account and access to our services:
                    </p>
                    <div className="bg-gray-800/30 p-4 rounded-xl ml-11 border border-gray-700/50">
                      <ul className="space-y-2 text-gray-300">
                        <li className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                            <span className="text-xs text-green-400">•</span>
                          </div>
                          <span>If you violate these Terms, traffic laws, or misuse our vehicles.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                            <span className="text-xs text-green-400">•</span>
                          </div>
                          <span>If you fail to pay fees or have outstanding balances.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                            <span className="text-xs text-green-400">•</span>
                          </div>
                          <span>If we suspect fraudulent activity or identity misrepresentation.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                            <span className="text-xs text-green-400">•</span>
                          </div>
                          <span>At our sole discretion for any other reason with reasonable notice.</span>
                        </li>
                      </ul>
                      <p className="text-sm text-gray-400 mt-4">
                        You may terminate your account at any time by contacting customer support, but you remain responsible 
                        for any outstanding charges or obligations incurred before termination.
                      </p>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-indigo-400" />
                      </div>
                      <h3 className="text-lg font-medium">General Legal Provisions</h3>
                    </div>
                    <div className="pl-11 space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                          <h4 className="font-medium mb-2">Governing Law</h4>
                          <p className="text-sm text-gray-400">
                            These Terms are governed by the laws of Hong Kong SAR. Any disputes will be resolved in the courts of Hong Kong.
                          </p>
                        </div>
                        <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                          <h4 className="font-medium mb-2">Changes to Terms</h4>
                          <p className="text-sm text-gray-400">
                            We may update these Terms from time to time. Significant changes will be notified via email or in-app notifications.
                          </p>
                        </div>
                        <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                          <h4 className="font-medium mb-2">Limitation of Liability</h4>
                          <p className="text-sm text-gray-400">
                            To the extent permitted by law, our liability is limited to direct damages and shall not exceed the amount you paid for the rental.
                          </p>
                        </div>
                        <div className="bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                          <h4 className="font-medium mb-2">Severability</h4>
                          <p className="text-sm text-gray-400">
                            If any provision of these Terms is found to be unenforceable, the remaining provisions will continue to be valid and enforceable.
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Lock className="w-4 h-4 text-blue-400" />
                      </div>
                      <h3 className="text-lg font-medium">Contact Information</h3>
                    </div>
                    <div className="pl-11">
                      <p className="text-gray-300 leading-relaxed">
                        If you have any questions about these Terms of Service, please contact us at:
                      </p>
                      <div className="mt-4 bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
                        <p className="text-sm text-gray-300">
                          Email: support@aircityhk.com<br/>
                          Customer Service: +852 5555 8888<br/>
                          Address: Central Plaza, 18 Harbour Road, Wan Chai, Hong Kong
                        </p>
                      </div>
                      <div className="mt-4">
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white">Contact Support</Button>
                      </div>
                    </div>
                  </section>
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
