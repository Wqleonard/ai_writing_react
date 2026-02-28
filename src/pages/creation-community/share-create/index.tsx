import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

/**
 * 创建/编辑分享页占位，待后续将 Vue share-create 重构后替换。
 */
const ShareCreatePage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <p className="text-gray-500">
        创建/编辑分享（ID: {id}）待后续重构
      </p>
      <Button
        variant="outline"
        onClick={() => navigate('/workspace/creation-community/share')}
      >
        返回分享列表
      </Button>
    </div>
  )
}

export default ShareCreatePage
