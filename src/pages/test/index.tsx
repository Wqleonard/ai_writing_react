import MainEditor from "@/components/MainEditor"
import { useEffect, useState } from "react"

const TestPage = () => {
    const [content, setContent] = useState("")

    useEffect(() => {
        console.log(content)
        
        setContent("==#123#highlight== nihao fasdfasd ==highlight==")
    }, [])

    return (
        <div className="h-screen w-screen">
            <MainEditor
                value={content}
                onChange={setContent}
            />
        </div>
    )
}

export default TestPage