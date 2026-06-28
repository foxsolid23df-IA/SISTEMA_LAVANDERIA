
const url = 'https://jugyosyrbixwsmzvdksp.supabase.co/rest/v1/profiles?id=eq.80cb0874-5973-4cbe-b9b9-3a3cb4586fc1&select=*';
const key = 'sb_publishable_pkUlkLzd6rPbvG9dD4usPg_qALhsbSd';

async function checkLicense() {
    try {
        const response = await fetch(url, {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

checkLicense();
