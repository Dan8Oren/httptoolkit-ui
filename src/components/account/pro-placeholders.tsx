import React from "react";

// Stub components for compatibility - Pro features are now available to all users

export const ProPill: React.FC<{
    className?: string,
    children?: string
}> = () => null;

export const ProHeaderPill: React.FC<{
    className?: string,
    children?: string
}> = () => null;

export const CardSalesPitch: React.FC<{
    children: React.ReactNode,
    source: string
}> = ({ children }) => <>{children}</>;

export class GetProOverlay extends React.Component<{
    getPro?: (source: string) => void,
    source?: string,
    children: React.ReactNode
}> {
    render() {
        return <>{this.props.children}</>;
    }
}