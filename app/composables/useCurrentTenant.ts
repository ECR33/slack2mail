type CurrentTenant = {
    tenant_id: string
    slug: string
    name: string
    brand_name: string       // brand_nameがnullならnameにフォールバック
    brand_icon_url: string | null
}

export const useCurrentTenant = () => {
    return useState<CurrentTenant | null>('currentTenant', () => null)
}