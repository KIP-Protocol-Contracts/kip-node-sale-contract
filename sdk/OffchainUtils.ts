import { KIPNode } from '../typechain-types/contracts/KIPNode';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';

export interface WhitelistInfo {
    address: string;
    amount: string;
}

export class OffchainUtils {
    public static generateMerkleTree(data: WhitelistInfo[]): StandardMerkleTree<[string, string]> {
        const tree = StandardMerkleTree.of<[string, string]>(data.map(info => [info.address, info.amount]), ["address", "uint256"]);
        return tree;
    }

    public static generateMerkleRoot(data: WhitelistInfo[]): string {
        const tree = OffchainUtils.generateMerkleTree(data);
        return tree.root;
    }

    public static generateMerkleProof(data: WhitelistInfo, whiteListInfo: WhitelistInfo): string[] {
        const tree = OffchainUtils.generateMerkleTree([data]);
        for (const [i, v] of tree.entries()) {
            if (v[0] === whiteListInfo.address) {
                return tree.getProof(i);
            }
        }
        
        throw new Error("Address not found in whitelist");
    }

    public static getProofFromTree(tree: StandardMerkleTree<[string, string]>, address: string): string[] {
        for (const [i, v] of tree.entries()) {
            if (v[0] === address) {
                return tree.getProof(i);
            }
        }
        
        throw new Error("Address not found in whitelist");
    }
    
    public generateWhitelistSale(
        list: WhitelistInfo[],
        maxPerTier: number,
        totalMintedAmount: number,
        start: Date,
        end: Date,
    ): KIPNode.WhitelistSaleStruct {
        return {
            merkleRoot: OffchainUtils.generateMerkleRoot(list),
            maxPerTier,
            totalMintedAmount,
            start: Math.floor(start.getTime() / 1000),
            end: Math.floor(end.getTime() / 1000),
        }
    }

    public generatePublicSale(
        price: number,
        maxPerTier: number,
        maxPerUser: number,
        totalMintedAmount: number,
        start: Date,
        end: Date,
    ): KIPNode.PublicSaleStruct {
        return {
            price,
            maxPerTier,
            maxPerUser,
            totalMintedAmount,
            start: Math.floor(start.getTime() / 1000),
            end: Math.floor(end.getTime() / 1000),
        }
    }
}