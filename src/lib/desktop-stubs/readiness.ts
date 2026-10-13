export type ConnectorReadiness = { ready: boolean };

export const getConnectorReadiness = async (): Promise<ConnectorReadiness> => ({ ready: false });
