import { BaseContract } from 'ethers';
import { KIPNode } from '../typechain-types/contracts/KIPNode';
import { KIPNode__factory } from '../typechain-types';

export class OffchainUtils {
    private readonly _kipNode: KIPNode;
    constructor(
        private _kipNodeAddress: string,
    ) {
        this._kipNode = new KIPNode__factory().attach(_kipNodeAddress) as KIPNode;
    }

    private _generateMerkleRoot(data: string[]): string {
        return data[0]
    }

    public generateWhitelistSale(
        maxPerTier: number,
        totalMintedAmount: number,
        start: Date,
        end: Date,
    ): KIPNode.WhitelistSaleStruct {
        return {
            merkleRoot: this._generateMerkleRoot([]),
            maxPerTier,
            totalMintedAmount,
            start,
            end,
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
            start,
            end,
        }
    }
}