import { KIPNode } from '../typechain-types/contracts/KIPNode';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';

export interface WhitelistInfo {
    address: string;
    amount: string;
}

export class OffchainUtils {
    public static generateMerkleRoot(data: WhitelistInfo[]): string {
        const tree = StandardMerkleTree.of(data.map(info => [info.address, info.amount]), ["address", "uint256"]);
        return tree.root;
    }

    public static generateMerkleProof(tree: StandardMerkleTree, data: WhitelistInfo): string[] {
        tree.getProof()
        return tree.proof(data);
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