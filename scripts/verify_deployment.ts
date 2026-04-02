import { fetch } from "bun";

const DEFAULT_URL = "https://api.dropsingal.app/v1/chat/completions";
const API_KEY = process.env.API_PROXY_KEY || "your_proxy_key_here";

async function verifyDeployment() {
    const url = process.argv[2] || DEFAULT_URL;
    console.log(`🚀 Verifying deployment at: ${url}`);
    console.log(`🔑 Using API Key: ${API_KEY.slice(0, 5)}...`);

    const providersFound = new Set<string>();
    const totalRequests = 10;
    let successes = 0;

    console.log(`\n📡 Sending ${totalRequests} requests to test round-robin balancing...\n`);

    for (let i = 1; i <= totalRequests; i++) {
        const start = performance.now();
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo", // Should work for all providers as we route internally
                    messages: [{ role: "user", content: "Say 'Hello' in one word." }],
                    stream: false
                })
            });

            const end = performance.now();
            const duration = (end - start).toFixed(0);

            if (response.ok) {
                const provider = response.headers.get("X-Provider") || "Unknown";
                const data = await response.json();
                const content = (data as any).choices?.[0]?.message?.content?.trim().slice(0, 20) || "No content";

                console.log(`✅ Req ${i}: [${provider}] - "${content}" (${duration}ms)`);
                providersFound.add(provider);
                successes++;
            } else {
                const text = await response.text();
                console.error(`❌ Req ${i}: Failed (${response.status}) - ${text.slice(0, 50)}`);
            }
        } catch (error: any) {
            console.error(`❌ Req ${i}: Network Error - ${error.message}`);
        }
    }

    console.log(`\n✨ Verification Summary:`);
    console.log(`✅ Success Rate: ${successes}/${totalRequests}`);
    console.log(`🔄 Providers Hit: ${Array.from(providersFound).join(", ")}`);

    if (successes === totalRequests) {
        console.log(`🎉 Deployment is HEALTHY!`);
    } else if (successes > 0) {
        console.log(`⚠️  Deployment is PARTIALLY HEALTHY. Check logs for failed requests.`);
    } else {
        console.log(`🚨 Deployment FAILED. Check URL and API Key.`);
    }
}

verifyDeployment();
