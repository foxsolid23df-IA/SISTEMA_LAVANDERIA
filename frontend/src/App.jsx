import { useEffect, useRef } from "react";
import { Routing } from "./router/routing"
import { platform } from "./utils/platform"
import './App.css'

const ANDROID_CHECK_INTERVAL = 500;
const ANDROID_CHECK_MAX = 10;

function App() {
    const retryCount = useRef(0);

    useEffect(() => {
        const theme = localStorage.getItem("theme");
        if (theme === "dark") {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }

        const applyPlatform = () => {
            const isAndroid = platform.isAndroid;
            document.body.classList.toggle("capacitor-android", isAndroid);
            return isAndroid;
        };

        if (!applyPlatform()) {
            const timer = setInterval(() => {
                retryCount.current += 1;
                if (applyPlatform() || retryCount.current >= ANDROID_CHECK_MAX) {
                    clearInterval(timer);
                }
            }, ANDROID_CHECK_INTERVAL);
            return () => {
                clearInterval(timer);
                document.body.classList.remove("capacitor-android");
            };
        }

        return () => document.body.classList.remove("capacitor-android");
    }, []);

    return (
        <div className="layout bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
            <Routing />
        </div>
    )
}

export default App