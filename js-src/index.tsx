import { __ } from '@wordpress/i18n';
import { close } from '@wordpress/icons';
import { useState } from '@wordpress/element';
import { createPortal } from '@wordpress/element';
import { Button, Spinner, Modal } from '@wordpress/components';
import styled from 'styled-components';

interface Plugin {
	name: string;
	slug: string;
	description: string;
	logoURL: string;
	docsURL: string;
	installed: boolean;
	activated: boolean;
	activateUrl: string;
}

const Wrapper = styled.div`
	display: flex;
	flex-direction: column;
	padding: 24px;
	background: #fff;
	font-family: var( --wp-admin-font-family );
	min-height: calc( 100vh - 32px );
`;

const Header = styled.div`
	display: flex;
	flex-direction: column;
	gap: 16px;
	margin-bottom: 32px;
`;

const PageTitle = styled.h1`
	font-size: 1.5rem;
	font-weight: 600;
	margin: 0;
	color: #1e1e1e;
`;

const PageSubtitle = styled.p`
	font-size: 14px;
	font-weight: 400;
	margin: 0;
	color: #646970;
	line-height: 1.5;
`;

const PluginsList = styled.div`
	display: grid;
	grid-template-columns: repeat( auto-fill, minmax( 500px, 1fr ) );
	gap: 24px;
	width: 100%;

	@media ( max-width: 768px ) {
		grid-template-columns: 1fr;
		gap: 16px;
	}
`;

const PluginItem = styled.div`
	display: flex;
	align-items: flex-start;
	gap: 20px;
	padding: 20px;
	background: #fff;
	border: 1px solid #e0e0e0;
	border-radius: 8px;
	position: relative;
`;

const PluginIcon = styled.div`
	flex-shrink: 0;
	width: 80px;
	height: 80px;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	padding: 12px;

	img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
`;

const PluginContent = styled.div`
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-width: 0;
`;

const PluginTitle = styled.h3`
	font-size: 18px;
	font-weight: 600;
	margin: 0;
	color: #2271b1;
	line-height: 1.4;
	cursor: pointer;

	&:hover {
		color: #135e96;
	}
`;

const PluginDescription = styled.p`
	font-size: 14px;
	color: #1e1e1e;
	margin: 0;
	line-height: 1.6;
`;

const PluginAuthor = styled.div`
	font-size: 14px;
	color: #1e1e1e;
	margin-top: 4px;

	a {
		color: #2271b1;
		text-decoration: none;

		&:hover {
			color: #135e96;
			text-decoration: underline;
		}
	}
`;

const PluginActions = styled.div`
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 8px;
	flex-shrink: 0;
	margin-left: 20px;
`;

const MoreDetailsLink = styled.button`
	font-size: 13px;
	color: #2271b1;
	cursor: pointer;
	line-height: 1.4;
	border: none;
	background: none;
	padding: 0;
	margin: 0;
	font-size: 13px;
	color: #2271b1;
	cursor: pointer;
`;

const StyledModal = styled( Modal )`
	.components-modal__header {
		display: none !important;
	}

	.components-modal__content {
		overflow: hidden !important;
		padding: 0 !important;
		margin: 0 !important;
	}

	.components-modal__header + div {
		overflow: hidden !important;
		height: 100% !important;
	}

	.components-modal__frame {
		overflow: hidden !important;
	}
`;

const ModalIframeWrapper = styled.div`
	width: 100%;
	height: calc( 100vh - 100px );
	position: relative;
`;

const ModalIframe = styled.iframe< { $isLoading: boolean } >`
	width: 100%;
	height: 100%;
	border: none;
	opacity: ${ ( props ) => ( props.$isLoading ? 0 : 1 ) };
	transition: opacity 0.3s ease;
`;

const LoadingSpinnerWrapper = styled.div< { $isLoading: boolean } >`
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate( -50%, -50% );
	z-index: 1;
	display: ${ ( props ) => ( props.$isLoading ? 'flex' : 'none' ) };
	align-items: center;
	justify-content: center;
`;

const ModalCloseButton = styled( Button )`
	position: fixed !important;
	top: 50px !important;
	right: calc( 50vw - 400px - 52px ) !important;
	z-index: 10000000 !important;
	background: #fff !important;
	border: 1px solid #ccc !important;
	border-radius: 4px !important;
	padding: 6px !important;
	min-width: auto !important;
	box-shadow: 0 2px 4px rgba( 0, 0, 0, 0.1 ) !important;
	display: flex !important;
	visibility: visible !important;
	opacity: 1 !important;

	@media ( max-width: 782px ) {
		right: calc( 5vw - 40px ) !important;
		top: 60px !important;
	}

	@media ( max-width: 480px ) {
		right: 0px !important;
		top: 40px !important;
	}

	&:hover {
		background: #f0f0f1 !important;
		border-color: #999 !important;
	}
`;

export default function OurPlugins( {
	initialPlugins,
	installNonce,
}: {
	initialPlugins: Plugin[];
	installNonce: string;
} ) {
	const [ selectedPluginSlug, setSelectedPluginSlug ] = useState<
		string | null
	>( null );
	const [ isIframeLoading, setIsIframeLoading ] = useState< boolean >( true );
	const [ plugins, setPlugins ] = useState< Plugin[] >( initialPlugins );
	const [ loadingPlugins, setLoadingPlugins ] = useState< Set< string > >(
		new Set()
	);
	const getStatusText = ( plugin: Plugin ): string => {
		if ( plugin.activated ) {
			return __( 'Activated' );
		}
		if ( plugin.installed ) {
			return __( 'Activate Now' );
		}
		return __( 'Install Now' );
	};

	const handleActionClick = async (
		plugin: Plugin,
		action: 'install' | 'activate'
	) => {
		setLoadingPlugins( ( prev ) => new Set( prev ).add( plugin.slug ) );

		if ( action === 'activate' ) {
			window.location.href = plugin.activateUrl
				.replaceAll( '&amp;', '&' )
				.replace( '%2F', '/' );
			return;
		}

		try {
			const form_data = new FormData();
			form_data.append( 'action', 'install-plugin' );
			form_data.append( 'slug', plugin.slug );
			form_data.append( '_ajax_nonce', installNonce );
			// Make AJAX request to the install/activate URL
			const response = await fetch( '/wp-admin/admin-ajax.php', {
				method: 'POST',
				body: form_data,
			} );

			const data = await response.json();

			// Check if the request was successful
			if ( data.success ) {
				setPlugins( ( prev ) =>
					prev.map( ( p ) =>
						p.slug === plugin.slug
							? {
									...p,
									installed: true,
									activateUrl: data.data?.activateUrl,
							  }
							: p
					)
				);
			} else {
				throw new Error(
					data.data?.message || __( 'Failed to install plugin' )
				);
			}
		} catch ( error: any ) {
			console.error( 'Error installing plugin:', error );
			alert(
				error.message ||
					__(
						'An error occurred while installing the plugin. Please try again.'
					)
			);
		} finally {
			setLoadingPlugins( ( prev ) => {
				const next = new Set( prev );
				next.delete( plugin.slug );
				return next;
			} );
		}
	};

	const getPluginInfoUrl = ( slug: string ): string => {
		const baseUrl = window.location.origin;
		return `${ baseUrl }/wp-admin/plugin-install.php?tab=plugin-information&plugin=${ slug }`;
	};

	const handlePluginTitleClick = ( slug: string ) => {
		setSelectedPluginSlug( slug );
		setIsIframeLoading( true );
	};

	const handleCloseModal = () => {
		setSelectedPluginSlug( null );
		setIsIframeLoading( true );
	};

	const handleIframeLoad = () => {
		setIsIframeLoading( false );
	};

	return (
		<Wrapper>
			<Header>
				<PageTitle>{ __( 'Our Plugins' ) }</PageTitle>
				<PageSubtitle>
					{ __(
						'Discover and install our premium WordPress plugins to enhance your website functionality.'
					) }
				</PageSubtitle>
			</Header>

			<PluginsList>
				{ plugins.map( ( plugin ) => {
					const isActive = plugin.activated;

					return (
						<PluginItem key={ plugin.slug }>
							<PluginIcon>
								<img
									src={ plugin.logoURL }
									alt={ plugin.name }
									loading="lazy"
								/>
							</PluginIcon>
							<PluginContent>
								<PluginTitle
									onClick={ () =>
										handlePluginTitleClick( plugin.slug )
									}
								>
									{ plugin.name }
								</PluginTitle>
								<PluginDescription>
									{ plugin.description }
								</PluginDescription>
								<PluginAuthor>
									{ __( 'See' ) }{ ' ' }
									<a
										href={ plugin.docsURL }
										target="_blank"
										rel="noopener noreferrer"
									>
										{ __( 'Documentation' ) }
									</a>
								</PluginAuthor>
							</PluginContent>
							<PluginActions>
								<button
									className={ `button${
										plugin.installed && ! plugin.activated
											? ' button-primary'
											: ''
									}` }
									onClick={ () =>
										handleActionClick(
											plugin,
											plugin.installed &&
												! plugin.activated
												? 'activate'
												: 'install'
										)
									}
									disabled={
										isActive ||
										loadingPlugins.has( plugin.slug )
									}
								>
									{ loadingPlugins.has( plugin.slug ) ? (
										<>
											<Spinner />{ ' ' }
											{ plugin.installed
												? __( 'Activating...' )
												: __( 'Installing...' ) }
										</>
									) : (
										getStatusText( plugin )
									) }
								</button>
								<MoreDetailsLink
									onClick={ () =>
										handlePluginTitleClick( plugin.slug )
									}
								>
									{ __( 'More Details' ) }
								</MoreDetailsLink>
							</PluginActions>
						</PluginItem>
					);
				} ) }
			</PluginsList>

			{ selectedPluginSlug &&
				createPortal(
					<ModalCloseButton
						icon={ close }
						onClick={ handleCloseModal }
						label={ __( 'Close' ) }
					/>,
					document.body
				) }
			{ selectedPluginSlug && (
				<StyledModal
					onRequestClose={ handleCloseModal }
					isFullScreen={ false }
					style={ { maxWidth: '800px', width: '90%' } }
				>
					<ModalIframeWrapper>
						<LoadingSpinnerWrapper $isLoading={ isIframeLoading }>
							<Spinner />
						</LoadingSpinnerWrapper>
						<ModalIframe
							src={ getPluginInfoUrl( selectedPluginSlug ) }
							title={ __( 'Plugin Information' ) }
							onLoad={ handleIframeLoad }
							$isLoading={ isIframeLoading }
						/>
					</ModalIframeWrapper>
				</StyledModal>
			) }
		</Wrapper>
	);
}
